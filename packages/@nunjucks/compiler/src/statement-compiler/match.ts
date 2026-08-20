import type { MatchNode, WhenNode } from '@nunjucks/nodes';
import { isArray, isDict, isLiteral, isSymbol } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { assertSafeIdentifier } from '../codegen.ts';
import type { Compiler } from '../create-compiler.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { compileDestructuring } from './pattern.ts';

// WHY: JSON.stringify maps NaN and ±Infinity to "null" and generated `x === NaN`
// is always false, so non-finite numeric patterns would never match — NaN is the
// only value not equal to itself (self-inequality is the dedicated test), and the
// infinities serialize to their valid JS literals.
const literalMatchCondition = (targetVar: string, value: unknown): string => {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return Number.isNaN(value)
      ? `${targetVar} !== ${targetVar}`
      : `${targetVar} === ${String(value)}`;
  }
  return `${targetVar} === ${JSON.stringify(value)}`;
};

interface MatchArmInput {
  compiler: Compiler;
  frame: Frame;
  caseNode: WhenNode;
  targetVar: string;
  matchedVar: string;
}

// WHY: extracted from compileMatch — one arm per call keeps both functions under
// the cognitive-complexity budget; emission order is byte-identical to the
// previous inline body.
const compileMatchArm = ({
  compiler,
  frame,
  caseNode,
  targetVar,
  matchedVar,
}: MatchArmInput): void => {
  const pattern = caseNode.pattern;
  // WHY: first-match semantics — pure pattern tests (literal equality, the
  // aggregate `!= null` check) compose the arm condition so an already-matched
  // arm is skipped wholesale, while bindings, destructuring, expression
  // patterns, and guards (walrus side effects) are prelude emissions INSIDE
  // the arm and cannot fire once an earlier arm has matched.
  const outerCondParts: string[] = [];
  const innerCondParts: string[] = [];
  const armPrelude: Array<() => void> = [];

  if (isLiteral(pattern)) {
    outerCondParts.push(literalMatchCondition(targetVar, pattern.value));
  } else if (isSymbol(pattern)) {
    const name = pattern.value;
    if (name !== '_') {
      assertSafeIdentifier(name, { compiler });
      armPrelude.push(() => {
        compiler.emitLine(
          `frame = frame.set({ name: ${JSON.stringify(name)}, value: ${targetVar} });`
        );
      });
    }
  } else if (isArray(pattern) || isDict(pattern)) {
    outerCondParts.push(`${targetVar} != null`);
    armPrelude.push(() => compileDestructuring({ compiler, frame }, pattern, targetVar));
  } else {
    const exprId = compiler.nextCompilerId();
    armPrelude.push(() => {
      compiler.emitLine(`let ${exprId} = `);
      compiler.compile(pattern, frame);
      compiler.emitLine(';');
    });
    innerCondParts.push(`${targetVar} === ${exprId}`);
  }

  const guard = caseNode.guard;
  if (guard) {
    const guardId = compiler.nextCompilerId();
    armPrelude.push(() => {
      compiler.emitLine(`let ${guardId} = `);
      compiler.compile(guard, frame);
      compiler.emitLine(';');
    });
    innerCondParts.push(guardId);
  }

  const outerCond = outerCondParts.length > 0 ? ` && (${outerCondParts.join(' && ')})` : '';
  compiler.emitLine(`if (!${matchedVar}${outerCond}) {`);
  for (const emit of armPrelude) {
    emit();
  }
  if (innerCondParts.length > 0) {
    compiler.emitLine(`if (${innerCondParts.join(' && ')}) {`);
  }
  compiler.emitLine(`${matchedVar} = true;`);
  compiler.compile(caseNode.body, frame);
  if (innerCondParts.length > 0) {
    compiler.emitLine('}');
  }
  compiler.emitLine('}');
};

/**
 * Compiles `{% match %}` as cascading `if (!matched …)` arms with first-match
 * semantics — each arm's pattern test guards the arm condition, and bindings,
 * destructuring, expression patterns, and guards are emitted inside the arm so
 * they only evaluate while the arm is actually being considered. Literals
 * compare with `===` (NaN via self-inequality), symbols bind (or match-all as
 * `_`), array/dict patterns destructure — with an optional trailing default.
 */
export const compileMatch = (
  compiler: Compiler,
  { node, frame: parentFrame }: CompileNodeInput<MatchNode>
): void => {
  const targetVar = compiler.nextCompilerId();
  const matchedVar = compiler.nextCompilerId();
  const frame = parentFrame.push(true);
  compiler.emitLine('frame = frame.push(true);');
  if (compiler.streamErrorRecovery) {
    const { lineno, colno } = node;
    compiler.emitLine(`let ${targetVar};`);
    compiler.emitLine(`try { ${targetVar} = `);
    compiler.compileExpression(node.expr, frame);
    compiler.emitLine('; ');
    compiler.emitStreamCatch(lineno, colno, `${targetVar} = undefined`);
  } else {
    compiler.emitLine(`let ${targetVar} = `);
    compiler.compileExpression(node.expr, frame);
    compiler.emitLine(';');
  }
  compiler.emitLine(`let ${matchedVar} = false;`);

  for (const caseNode of node.cases) {
    compileMatchArm({ compiler, frame, caseNode, targetVar, matchedVar });
  }

  if (node.default) {
    compiler.emitLine(`if (!${matchedVar}) {`);
    compiler.compile(node.default, frame);
    compiler.emitLine('}');
  }

  compiler.emitLine('frame = frame.pop();');
};

// WHY: WhenNode is compiled inline by compileMatch and must never reach the dispatcher directly; this stub is a defensive guard that fails loudly if dispatch routing is broken.
export const compileWhen = (compiler: Compiler, _input: CompileNodeInput<WhenNode>): void => {
  compiler.fail({
    message: 'when: WhenNode should be compiled by compileMatch, not dispatched directly',
    lineno: 0,
    colno: 0,
  });
};
