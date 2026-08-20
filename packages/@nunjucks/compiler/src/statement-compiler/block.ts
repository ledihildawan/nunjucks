import type { BlockNode, SuperNode } from '@nunjucks/nodes';
import { assertSafeIdentifier, emitLineLocation } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

/**
 * Compiles a `{% block %}` reference: generator contexts delegate with
 * `yield* context.getBlock(...)`, buffered contexts drain it via
 * `runtime.collectString` — top-level in-place rendering is guarded on
 * `parentTemplate === null` so extends doesn't emit the block twice.
 */
export const compileBlock = (compiler: Compiler, node: BlockNode): void => {
  const nameNode =
    typeof node.name === 'string'
      ? { value: node.name, lineno: node.lineno, colno: node.colno }
      : node.name;
  const name = typeof node.name === 'string' ? node.name : String(nameNode?.value ?? 'block');
  assertSafeIdentifier(name, { compiler, lineno: node.lineno, colno: node.colno });
  // WHY: Option C — block functions are async generators. In a generator context (buffer === null) delegate with yield* so the block's chunks stream through; in a string-accumulating context (capture/slot buffer) drain the block into a string via runtime.collectString.
  const blockInvoke = `(await context.getBlock(${JSON.stringify(name)}, ${node.lineno}, ${node.colno}))(env, context, frame, runtime)`;
  // WHY: only TOP-LEVEL blocks (compiled in root scope) reference parentTemplate for the
  // extends guard — `let parentTemplate` lives in root's scope, and block bodies compiled
  // inside b_* functions (compiler.inBlock) would hit a ReferenceError on it. Nested
  // blocks are part of their parent block's body and always render in place.
  const guard = !compiler.inBlock;
  if (compiler.buffer === null) {
    if (guard) {
      // WHY: under {% extends %} the PARENT renders the (overridden) top-level block
      // during its delegation pass — rendering it in place here as well would emit it
      // twice, so the in-place yield is guarded on the absence of a parent template.
      compiler.emitLine('if(parentTemplate === null) {');
      compiler.emitLine(`  yield* ${blockInvoke};`);
      compiler.emitLine('}');
    } else {
      compiler.emitLine(`yield* ${blockInvoke};`);
    }
  } else if (guard) {
    compiler.emitLine(
      `if(parentTemplate === null) { ${compiler.buffer} += await runtime.collectString(${blockInvoke}); }`
    );
  } else {
    compiler.emitLine(`${compiler.buffer} += await runtime.collectString(${blockInvoke});`);
  }
};

/**
 * Compiles `super` to a `context.getSuper({ ..., block: b_<name>, ... })`
 * lookup whose result is `markSafe`'d and bound into the frame as `id`.
 */
export const compileSuper = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<SuperNode>
): void => {
  const name = node.blockName;
  const id = String(node.symbol?.value ?? 'super');
  assertSafeIdentifier(name, { compiler, lineno: node.lineno, colno: node.colno });
  assertSafeIdentifier(id, { compiler, lineno: node.lineno, colno: node.colno });

  emitLineLocation(compiler, node.lineno, node.colno);
  // WHY: the `let` is load-bearing — compiled templates execute via new Function in
  // sloppy mode, so an undeclared assignment would leak an implicit global and let
  // concurrently-rendering templates clobber each other's super content at await points.
  compiler.emitLine(
    `let ${id} = await context.getSuper({ environment: env, name: ${JSON.stringify(name)}, block: b_${name}, frame, runtime, lineno: ${node.lineno}, colno: ${node.colno} });`
  );
  compiler.emitLine(`${id} = runtime.markSafe(${id});`);
  compiler.emitLine(`frame = frame.set({ name: ${JSON.stringify(id)}, value: ${id} });`);
  frame.set({ name: id, value: id });
};
