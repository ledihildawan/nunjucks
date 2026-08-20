import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { createFrame } from '@nunjucks/runtime';
import { assertSafeIdentifier } from '../codegen.ts';
import type { Compiler } from '../create-compiler.ts';

interface SlotFunctionInput {
  compiler: Compiler;
  params: readonly string[];
  body: Node;
  parentFrame: Frame;
  slotVar: string;
}

/**
 * Emits `let <slotVar> = async (l_p1, ...) => {...}` — params validated as
 * safe identifiers, body accumulated into a pushed buffer, and the
 * generator-scope `frame` saved/restored around the awaits.
 */
const compileSlotFunction = ({
  compiler,
  params,
  body,
  parentFrame,
  slotVar,
}: SlotFunctionInput): void => {
  // WHY: defense-in-depth — slot params come from lexer `symbol` tokens (DELIM_CHARS blocks the run), but we still validate them as identifiers before emitting them into the generated source. Without this, a malformed upstream could insert `;` or `"` into the generated JS via `l_${param}`.
  for (const param of params) {
    assertSafeIdentifier(param, { compiler });
  }
  const localParams = params.map((p) => `l_${p}`);

  compiler.emitLine(`let ${slotVar} = async (${localParams.join(', ')}) => {`);
  // WHY: save/restore of the generator-scope frame — a `let frame` shadow here is a
  // TDZ trap (the first parent capture would reference the shadow before init).
  // Restoring after the body's awaits is safe today because slot functions only run
  // while the owning generator is suspended awaiting the component call, so no other
  // rebinding of `frame` interleaves with the restore.
  compiler.emitLine('  const __slotFrame = frame;');
  compiler.emitLine('  frame = runtime.createFrame({ parent: __slotFrame });');

  const slotFrame = createFrame({ parent: parentFrame });
  for (const param of params) {
    // WHY: `${param}` is interpolated into a double-quoted JS string literal — JSON.stringify escapes it so the generated source is well-formed even if upstream ever yields a non-identifier.
    compiler.emitLine(
      `  frame = frame.set({ name: ${JSON.stringify(param)}, value: l_${param} });`
    );
  }

  const buf = compiler.pushBuffer();
  compiler.withScopedSyntax(() => {
    compiler.compile(body, slotFrame);
  });
  compiler.emitLine('  frame = __slotFrame;');
  compiler.emitLine(`  return runtime.createSafeString(${buf});`);
  compiler.emitLine('}');
  compiler.popBuffer();
};

export { compileSlotFunction };
