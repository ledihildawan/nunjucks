// WHY: terminals advance the cursor by CELL, not by UTF-16 code unit — CJK and
// fullwidth glyphs occupy two cells, combining marks and controls zero. Caret
// lines built from '.length' misalign on anything but ASCII. This is a pragmatic
// wcwidth approximation, NOT full UAX#11: compact tables covering the common
// blocks; rare scripts and sequences (ZWJ families, regional-indicator pairs)
// may be off by a cell, which is acceptable for caret alignment.

// Mn/Me/Mc approximation for common blocks: Latin/Greek diacritics (0300–036F),
// Cyrillic (0483–0489, 2DE0–2DFF, A66F–A672, A674–A67D), Hebrew points
// (0591–05C7), Arabic (0610–061A, 064B–065F, 0670, 06D6–06ED), Syriac/Thaana/
// Nko (0711–07F3), Samaritan (0816–082D, 0859–085B), Devanagari + Bengali vowel
// signs (0900–0903, 093C, 093E–094F, 0951–0957, 0962–0963, 0981, 09BC–09D7,
// 09E2–09E3 — Mc counted as 0), Thai/Lao (0E31–0E4E, 0EB1–0ECD), Tibetan
// (0F71–0FBC), Myanmar (102D–103E), Khmer (17B4–17D3), Mongolian FVS
// (180B–180D), combining extended/supplement (1AB0–1AFF, 1DC0–1DFF), zero-width
// + bidi controls (200B–200F, 202A–202E, 2060–2064, FEFF), symbol marks
// (20D0–20F0), Coptic (2CEF–2CF1), CJK tone marks + kana voicing (302A–302F,
// 3099–309A), variation selectors (FE00–FE0F) and half marks (FE20–FE2F).
// biome-ignore-start lint/suspicious/noMisleadingCharacterClass: the class intentionally lists combining-mark ranges; biome misreads adjacent escaped Mn ranges (e.g. \u103E next to \u180B) as a base+combining pair — no literal combining characters are present.
const ZERO_WIDTH_RE =
  /[\u0300-\u036F\u0483-\u0489\u0591-\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u0816-\u082D\u0859-\u085B\u0900-\u0903\u093C\u093E-\u094F\u0951-\u0957\u0962-\u0963\u0981\u09BC\u09BE-\u09CC\u09CD\u09D7\u09E2-\u09E3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECD\u0F71-\u0F7E\u0F80-\u0F84\u0F8D-\u0FBC\u102D-\u103E\u17B4-\u17D3\u180B-\u180D\u1AB0-\u1AFF\u1DC0-\u1DFF\u200B-\u200F\u202A-\u202E\u2060-\u2064\u20D0-\u20F0\u2CEF-\u2CF1\u2DE0-\u2DFF\u302A-\u302F\u3099-\u309A\uA66F-\uA672\uA674-\uA67D\uA69E-\uA69F\uA6F0-\uA6F1\uFE00-\uFE0F\uFE20-\uFE2F\uFEFF]/u;
// biome-ignore-end lint/suspicious/noMisleadingCharacterClass: end of escaped-range class

// East Asian Wide/Fullwidth (BMP): Hangul Jamo (1100–115F, A960–A97C, AC00–
// D7A3), CJK radicals/punctuation through compatibility (2E80–303E, 3041–33FF),
// CJK ideographs (3400–4DBF, 4E00–9FFF, F900–FAFF), vertical/small forms
// (FE10–FE19, FE30–FE6F), fullwidth forms (FF00–FF60, FFE0–FFE6).
const WIDE_BMP_RE =
  /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA960-\uA97C\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/u;

// Astral wide ranges: SMP emoji pictograph blocks (1F300–1FAFF) and plane-2 CJK
// extensions B–G plus compat (20000–3FFFD). Other astral planes count 1 cell.
const ASTRAL_WIDE_RANGES: readonly (readonly [number, number])[] = [
  [0x1f300, 0x1faff],
  [0x20000, 0x3fffd],
];

const HIGH_SURROGATE_MIN = 0xd800;
const HIGH_SURROGATE_MAX = 0xdbff;
const LOW_SURROGATE_MIN = 0xdc00;
const LOW_SURROGATE_MAX = 0xdfff;
const SURROGATE_BASE = 0x400;
const ASTRAL_OFFSET = 0x10000;

const bmpCellWidth = (code: number): number => {
  // WHY: C0/C1 controls are checked numerically, not in a regex — biome bans
  // control characters in regex literals. They are sanitized before display
  // anyway, so counting them 0 matches what actually reaches the terminal.
  if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
    return 0;
  }
  if (ZERO_WIDTH_RE.test(String.fromCharCode(code))) {
    return 0;
  }
  if (WIDE_BMP_RE.test(String.fromCharCode(code))) {
    return 2;
  }
  return 1;
};

const astralCellWidth = (codePoint: number): number =>
  ASTRAL_WIDE_RANGES.some(([low, high]) => codePoint >= low && codePoint <= high) ? 2 : 1;

/**
 * Terminal display width (cell count) of `text`: CJK/fullwidth glyphs count 2,
 * combining marks and controls 0, astral pairs (e.g. emoji) one unit — 2 on the
 * wide emoji/CJK-extension planes, 1 elsewhere. A pragmatic wcwidth
 * approximation, not full UAX#11; lone surrogates count 1 defensively.
 */
const displayWidth = (text: string): number => {
  let width = 0;
  let index = 0;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    // WHY: an astral pair is two code units but one glyph — measure the combined
    // code point and skip its low surrogate so emoji are never split into two
    // units of width 1.
    if (code >= HIGH_SURROGATE_MIN && code <= HIGH_SURROGATE_MAX) {
      const next = text.charCodeAt(index + 1);
      if (next >= LOW_SURROGATE_MIN && next <= LOW_SURROGATE_MAX) {
        const codePoint =
          ASTRAL_OFFSET + (code - HIGH_SURROGATE_MIN) * SURROGATE_BASE + (next - LOW_SURROGATE_MIN);
        width += astralCellWidth(codePoint);
        index += 2;
        continue;
      }
    }
    width += bmpCellWidth(code);
    index += 1;
  }
  return width;
};

export { displayWidth };
