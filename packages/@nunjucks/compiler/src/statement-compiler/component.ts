import { isDict, isKeywordArgs } from '@nunjucks/nodes';
import type { Node, ComponentNode, ChildrenNode, PairNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { createFrame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';
import { compileSlotFunction } from './slot.ts';

type ComponentLikeNode = ComponentNode;

const extractComponentArgs = (ctx: Compiler, node: ComponentLikeNode): { args: readonly Node[]; kwargs: ChildrenNode | null } => {
  const all = [...node.args];
  const last = all[all.length - 1];
  const kwargs = last !== undefined && (isDict(last) || isKeywordArgs(last)) ? (last as ChildrenNode) : null;
  const args = kwargs ? all.slice(0, -1) : all;
  for (const arg of args) {
    ctx.assertType(arg, 'symbol');
  }
  return { args, kwargs };
};

const pairKey = (pair: Node): string => {
  const key = (pair as PairNode).key;
  if (typeof key === 'string') { return key; }
  return typeof key.value === 'string' ? key.value : '';
};

const buildComponentArgNames = (args: readonly Node[], kwargs: ChildrenNode | null): { argNames: string[]; kwargNames: string[]; realNames: string[] } => {
  const argNames = args.map((n) => `"${n.value as string}"`);
  const kwargNames = (kwargs?.children ?? []).map((n) => `"${pairKey(n)}"`);
  const realNames = [...args.map((n) => `l_${n.value as string}`), 'kwargs'];
  return { argNames, kwargNames, realNames };
};

const emitComponentArgBindings = (ctx: Compiler, args: readonly Node[], kwargs: ChildrenNode | null, currFrame: Frame): void => {
  forEach(args, arg => {
    const argValue = arg.value as string;
    ctx.emitLine(`frame.set("${argValue}", l_${argValue});`);
    currFrame.set(argValue, `l_${argValue}`);
  });

  if (kwargs) {
    const positionalNames = new Set(args.map((n) => n.value as string));
    forEach(kwargs.children, pair => {
      const name = pairKey(pair);
      const isPositional = positionalNames.has(name);
      ctx.emit(`frame.set("${name}", `);
      ctx.emit(`Object.hasOwn(kwargs, "${name}")`);
      ctx.emit(` ? kwargs["${name}"] : `);
      if (isPositional) {
        ctx.emit(`(l_${name} !== undefined ? l_${name} : `);
      }
      ctx.compileExpression((pair as PairNode).value, currFrame);
      if (isPositional) {
        ctx.emit(')');
      }
      ctx.emit(');');
    });
  }
};

const compileComponent = (ctx: Compiler, node: ComponentNode, frame?: Frame): string => {
  const { args, kwargs } = extractComponentArgs(ctx, node);
  const funcId = `component_${ctx.tmpid()}`;
  const keepFrame = (frame !== undefined);
  const { argNames, kwargNames, realNames } = buildComponentArgNames(args, kwargs);

  const currFrame = keepFrame ? frame?.push(true) : createFrame();
  const frameAssignment = keepFrame ? 'frame.push(true);' : 'runtime.createFrame();';

  ctx.emitLines(
    `let ${funcId} = runtime.makeComponent(`,
    `[${argNames.join(', ')}], `,
    `[${kwargNames.join(', ')}], `,
    `async (${realNames.join(', ')}) => {`,
    'let outerFrame = frame;',
    `frame = ${frameAssignment}`,
    'kwargs ??= {};');

  emitComponentArgBindings(ctx, args, kwargs, currFrame);

  // Fallback slots come only from `{% slot %}` declarations. The component
  // body itself is definition markup (always rendered) — not the default.
  const fallbackEntries: string[] = [];
  for (const slot of node.fallbackSlots ?? []) {
    const slotVar = `__fallback_${slot.name}`;
    compileSlotFunction(ctx, slot.params, slot.body, currFrame, slotVar);
    fallbackEntries.push(`"${slot.name}": ${slotVar}`);
  }

  // Component context: assembles props + slot resolver. `slots` (provided by
  // {% render %}) comes through kwargs.
  const ccId = `__component_${ctx.tmpid()}`;
  const propEntries = args.map((n) => `"${n.value as string}": l_${n.value as string}`).join(', ');
  const propsCode = propEntries === '' ? '{ ...__props }' : `{ ${propEntries}, ...__props }`;
  ctx.emitLines(
    'const { slots: __slots, keywords: __keywords, ...__props } = kwargs;',
    `let ${ccId} = runtime.createComponentContext(${propsCode}, runtime.createSlotContext({ ${fallbackEntries.join(', ')} }, __slots));`,
    'for (const [__k, __v] of Object.entries(__props)) { if (__v !== undefined) frame.set(__k, __v); }',
    `frame.set("slot", ${ccId}.slots);`);

  // Compile-time frame bindings: `slot` resolves to the slot context, and the
  // magic `children` symbol becomes a default-slot call inside component bodies.
  currFrame.set('slot', `${ccId}.slots`);
  currFrame.set('children', `${ccId}.slots("default")`);

  const bufferId = ctx.pushBuffer();

  ctx.withScopedSyntax(() => {
    ctx.compile(node.body, currFrame);
  });

  const frameRestore = keepFrame ? 'frame.pop();' : 'outerFrame;';
  ctx.emitLine(`frame = ${frameRestore}`);
  ctx.emitLine(`return runtime.createSafeString(${bufferId});`);
  ctx.emitLine('});');
  ctx.popBuffer();

  return funcId;
};

export const compileComponentPublic = (ctx: Compiler, node: ComponentNode, frame: Frame): void => {
  const funcId = compileComponent(ctx, node);

  const name = node.name as string;
  frame.set(name, funcId);

  if (frame.parent) {
    ctx.emitLine(`frame.set("${name}", ${funcId});`);
  } else {
    if (name.charAt(0) !== '_') {
      ctx.emitLine(`context.addExport("${name}");`);
    }
    ctx.emitLine(`context.setVariable("${name}", ${funcId});`);
  }
};
