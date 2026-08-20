// WHY: nested-quantifier DETECTION lives in the security kernel because it is domain
// policy (which template-authored regex shapes are safe to compile), while staying a
// pure string predicate so parser (regex literals) and runtime (`is matches`) can share
// one guard without an acyclic-dependency violation.

interface GroupFrame {
  hadVariableLengthAtom: boolean;
}

const BOUNDED_REPETITION_RE = /^\{(\d+)(,(\d*)?)?\}/u;

const isQuantifierChar = (char: string): boolean => char === '+' || char === '*' || char === '?';

/**
 * Parses a `{n}`, `{n,}`, or `{n,m}` repetition at the start of `tail`.
 * Returns null when the brace does not parse as a repetition (a literal `{`).
 */
const parseBoundedRepetition = (
  tail: string
): { readonly length: number; readonly variableLength: boolean } | null => {
  const match = BOUNDED_REPETITION_RE.exec(tail);
  if (match === null) {
    return null;
  }
  const min = Number.parseInt(match[1] ?? '0', 10);
  if (match[2] === undefined) {
    // `{n}` repeats a fixed count — deterministic, never backtracks by itself.
    return { length: match[0].length, variableLength: false };
  }
  const max =
    match[3] === undefined || match[3] === ''
      ? Number.POSITIVE_INFINITY
      : Number.parseInt(match[3], 10);
  return { length: match[0].length, variableLength: max !== min };
};

/**
 * Checks a regex pattern source for nested quantifiers — a variable-length quantified
 * subexpression inside a group that is itself quantified (star-height ≥ 1), e.g.
 * `(a+)+`, `(a*)*`, `(\d+\s*)+$`, `(a?)+`, `(a{1,3})+`. This shape is what turns
 * non-matching subjects into exponential (or high-polynomial) backtracking, so length
 * caps alone cannot neutralize it: `(a+)+$` is 7 characters and catastrophic against
 * 10,000 `a`s. Fixed repetitions (`(a{2})+`) stay allowed — they are deterministic.
 *
 * Detection is deliberately conservative (fails closed): a `{` that does not parse as
 * a bounded repetition is treated as a literal brace, escapes and character classes
 * are skipped structurally, and lazy `?` suffixes are ignored. The known trade-off is
 * false positives on exotic-but-linear patterns — rejecting a template regex outright
 * is always safer than stalling the render loop.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: a regex scanner is a single cohesive state machine — its branches share inClass/escaped/canQuantify/closedGroupDangerous state, and fragmenting them into helper functions would force threading a mutable state object through every call. Same exemption class as the lexer/highlighter scanners.
export const isDangerousRegexPattern = (source: string): boolean => {
  // WHY: hand-rolled scanner (not a regex-of-a-regex) — quantifier nesting is
  // inherently recursive, and a structural scan is the only way to skip character
  // classes and escapes without re-parsing them as operators.
  const stack: GroupFrame[] = [{ hadVariableLengthAtom: false }];
  let inClass = false;
  let escaped = false;
  let canQuantify = false;
  let closedGroupDangerous = false;

  const consumeQuantifier = (): boolean => {
    if (closedGroupDangerous) {
      return true;
    }
    const frame = stack.at(-1);
    if (frame !== undefined) {
      frame.hadVariableLengthAtom = true;
    }
    canQuantify = false;
    return false;
  };

  for (let index = 0; index < source.length; index++) {
    const char = source[index];

    if (escaped) {
      escaped = false;
      canQuantify = true;
      closedGroupDangerous = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (inClass) {
      if (char === ']') {
        inClass = false;
        canQuantify = true;
        closedGroupDangerous = false;
      }
      continue;
    }
    if (char === '[') {
      inClass = true;
      continue;
    }
    if (char === '(') {
      stack.push({ hadVariableLengthAtom: false });
      canQuantify = false;
      closedGroupDangerous = false;
      continue;
    }
    if (char === ')') {
      const frame = stack.pop();
      if (frame === undefined) {
        // Unbalanced — the RegExp constructor will reject it; not a policy concern.
        continue;
      }
      closedGroupDangerous = frame.hadVariableLengthAtom;
      if (frame.hadVariableLengthAtom) {
        // Propagate upward so `((a+)b)+` flags at the OUTER quantifier too.
        const parent = stack.at(-1);
        if (parent !== undefined) {
          parent.hadVariableLengthAtom = true;
        }
      }
      canQuantify = true;
      continue;
    }

    const repetition = char === '{' ? parseBoundedRepetition(source.slice(index)) : null;
    if (repetition !== null) {
      if (canQuantify && repetition.variableLength) {
        if (consumeQuantifier()) {
          return true;
        }
      } else if (canQuantify) {
        canQuantify = false;
      }
      index += repetition.length - 1;
      continue;
    }

    if (char !== undefined && isQuantifierChar(char)) {
      if (canQuantify && consumeQuantifier()) {
        return true;
      }
      continue;
    }

    if (char === '|') {
      // WHY: fail-closed — an alternation inside a group makes the group's content
      // ambiguous (overlapping or differently-lengthed branches), so quantifying the
      // group yields the classic exponential shapes `(a|a)+` / `(a|aa)+` that carry
      // no nested quantifier for the structural scan to key on.
      const frame = stack.at(-1);
      if (frame !== undefined) {
        frame.hadVariableLengthAtom = true;
      }
    }

    // WHY: a bare atom is itself quantifiable, and a quantifier landing here binds to
    // the atom — never to a group closed earlier (`(a)b+` must not read as `(a+)`).
    canQuantify = true;
    closedGroupDangerous = false;
  }
  return false;
};
