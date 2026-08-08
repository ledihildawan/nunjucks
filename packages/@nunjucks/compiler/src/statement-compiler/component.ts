import { isDict, isKeywordArgs } from '@nunjucks/nodes';
import type { Node, ComponentNode, ChildrenNode, PairNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { createFrame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';
import { compileSlotFunction } from './slot.ts';

const extractComponentArgs = (compiler: Compiler, node: ComponentNode): { args: readonly Node[]; kwargs: ChildrenNode | null } => {
  const all = [...node.args];
  const last = all[all.length - 1];
  const kwargs = last !== undefined && (isDict(last) || isKeywordArgs(last)) ? last : null;
  const args = kwargs ? all.slice(0, -1) : all;
  forEach(args, (argument) => { compiler.assertType(argument, 'symbol'); });
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

const emitComponentArgBindings = (compiler: Compiler, args: readonly Node[], kwargs: ChildrenNode | null, currFrame: Frame): void => {
  forEach(args, argument => {
    const argValue = argument.value as string;
    compiler.emitLine(`frame = frame.set("${argValue}", l_${argValue});`);
    currFrame.set(argValue, `l_${argValue}`);
  });

  if (kwargs) {
    const positionalNames = new Set(args.map((n) => n.value as string));
    forEach(kwargs.children, pair => {
      const name = pairKey(pair);
      const isPositional = positionalNames.has(name);
      compiler.emit(`frame = frame.set("${name}", `);
      compiler.emit(`Object.hasOwn(kwargs, "${name}")`);
      compiler.emit(` ? kwargs["${name}"] : `);
      if (isPositional) {
        compiler.emit(`(l_${name} !== undefined ? l_${name} : `);
      }
      compiler.compileExpression((pair as PairNode).value, currFrame);
      if (isPositional) {
        compiler.emit(')');
      }
      compiler.emit(');');
    });
  }
};

const emitFallbackEntries = (compiler: Compiler, slots: readonly { name: string; params: string[]; body: Node }[], currFrame: Frame): string[] =>
  slots.map((slot) => {
    const slotVar = `__fallback_${slot.name}`;
    compileSlotFunction({ compiler, params: slot.params, body: slot.body, parentFrame: currFrame, slotVar });
    return `"${slot.name}": ${slotVar}`;
  });

const emitComponentContext = (
  compiler: Compiler,
  args: readonly Node[],
  fallbackEntries: string[]
): string => {
  const ccId = `__component_${compiler.tmpid()}`;
  const propEntries = args.map((n) => `"${n.value as string}": l_${n.value as string}`).join(', ');
  const propsCode = propEntries === '' ? '{ ...__props }' : `{ ${propEntries}, ...__props }`;
  compiler.emitLines(
    'const { slots: __slots, keywords: __keywords, ...__props } = kwargs;',
    `let ${ccId} = runtime.createComponentContext(${propsCode}, runtime.createSlotContext({ ${fallbackEntries.join(', ')} }, __slots));`,
    'for (const [__k, __v] of Object.entries(__props)) { if (__v !== undefined) frame = frame.set(__k, __v); }',
    `frame = frame.set("slot", ${ccId}.slots);`,
    `frame = frame.set("children", ${ccId}.slots("default"));`);
  return ccId;
};

const compileComponent = (compiler: Compiler, node: ComponentNode): string => {
  const { args, kwargs } = extractComponentArgs(compiler, node);
  const funcId = `component_${compiler.tmpid()}`;
  const { argNames, kwargNames, realNames } = buildComponentArgNames(args, kwargs);

  const currFrame = createFrame();

  compiler.emitLines(
    `let ${funcId} = runtime.makeComponent(`,
    `[${argNames.join(', ')}], `,
    `[${kwargNames.join(', ')}], `,
    `async (${realNames.join(', ')}) => {`,
    'let outerFrame = frame;',
    'frame = runtime.createFrame();',
    'kwargs ??= {};');

  emitComponentArgBindings(compiler, args, kwargs, currFrame);

  const fallbackEntries = emitFallbackEntries(compiler, node.fallbackSlots ?? [], currFrame);
  const ccId = emitComponentContext(compiler, args, fallbackEntries);

  currFrame.set('slot', `${ccId}.slots`);
  currFrame.set('children', `${ccId}.slots("default")`);

  const bufferId = compiler.pushBuffer();

  compiler.withScopedSyntax(() => {
    compiler.compile(node.body, currFrame);
  });

  compiler.emitLine('frame = outerFrame;');
  compiler.emitLine(`return runtime.createSafeString(${bufferId});`);
  compiler.emitLine('});');
  compiler.popBuffer();

  return funcId;
};

export const compileComponentPublic = (compiler: Compiler, node: ComponentNode, frame: Frame): void => {
  const funcId = compileComponent(compiler, node);

  const name = node.name;
  frame.set(name, funcId);

  if (frame.parent) {
    compiler.emitLine(`frame = frame.set("${name}", ${funcId});`);
  } else {
    if (name[0] !== '_') {
      compiler.emitLine(`context.addExport("${name}");`);
    }
    compiler.emitLine(`context.setVariable("${name}", ${funcId});`);
  }
};
