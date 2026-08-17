import type { ChildrenNode, ComponentNode, Node, SlotBlock } from '@nunjucks/nodes';
import { isDict, isKeywordArgs, isPair } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { createFrame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import { assertSafeIdentifier } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { compileSlotFunction } from './slot.ts';

const extractComponentArgs = (
  compiler: Compiler,
  node: ComponentNode
): { args: readonly Node[]; kwargs: ChildrenNode | null } => {
  const all = [...node.args];
  const last = all[all.length - 1];
  const kwargs = last !== undefined && (isDict(last) || isKeywordArgs(last)) ? last : null;
  const args = kwargs ? all.slice(0, -1) : all;
  // WHY: defense-in-depth — component arg names flow into generated JS identifiers (`l_${name}`),
  // so they are validated as identifiers at the codegen boundary exactly like slot params.
  forEach(args, (argument) => {
    compiler.assertType(argument, 'symbol');
    assertSafeIdentifier(String(argument.value), { compiler });
  });
  return { args, kwargs };
};

const pairKey = (pair: Node): string => {
  if (!isPair(pair)) {
    return '';
  }
  const key = pair.key;
  if (typeof key === 'string') {
    return key;
  }
  return typeof key.value === 'string' ? key.value : '';
};

const buildComponentArgNames = (
  args: readonly Node[],
  kwargs: ChildrenNode | null
): { argNames: string[]; kwargNames: string[]; realNames: string[] } => {
  const argNames = args.map((arg) => JSON.stringify(String(arg.value)));
  const kwargNames = (kwargs?.children ?? []).map((pair) => JSON.stringify(pairKey(pair)));
  const realNames = [...args.map((arg) => `l_${String(arg.value)}`), 'kwargs'];
  return { argNames, kwargNames, realNames };
};

interface EmitComponentArgBindingsInput {
  args: readonly Node[];
  kwargs: ChildrenNode | null;
  frame: Frame;
}

const emitComponentArgBindings = (
  compiler: Compiler,
  { args, kwargs, frame }: EmitComponentArgBindingsInput
): void => {
  forEach(args, (argument) => {
    const argValue = String(argument.value);
    compiler.emitLine(
      `frame = frame.set({ name: ${JSON.stringify(argValue)}, value: l_${argValue} });`
    );
    frame.set({ name: argValue, value: `l_${argValue}` });
  });

  if (kwargs) {
    const positionalNames = new Set(args.map((arg) => String(arg.value)));
    forEach(kwargs.children, (pair) => {
      if (!isPair(pair)) {
        return;
      }
      const name = pairKey(pair);
      const isPositional = positionalNames.has(name);
      compiler.emit(`frame = frame.set({ name: ${JSON.stringify(name)}, value: `);
      compiler.emit(`Object.hasOwn(kwargs, ${JSON.stringify(name)})`);
      compiler.emit(` ? kwargs[${JSON.stringify(name)}] : `);
      if (isPositional) {
        compiler.emit(`(l_${name} !== undefined ? l_${name} : `);
      }
      compiler.compileExpression(pair.value, frame);
      if (isPositional) {
        compiler.emit(')');
      }
      compiler.emit(' });');
    });
  }
};

const emitFallbackEntries = (
  compiler: Compiler,
  slots: readonly SlotBlock[],
  currFrame: Frame
): string[] =>
  slots.map((slot) => {
    assertSafeIdentifier(slot.name, { compiler });
    const slotVar = `__fallback_${slot.name}`;
    compileSlotFunction({
      compiler,
      params: slot.params,
      body: slot.body,
      parentFrame: currFrame,
      slotVar,
    });
    return `${JSON.stringify(slot.name)}: ${slotVar}`;
  });

const emitComponentContext = (
  compiler: Compiler,
  args: readonly Node[],
  fallbackEntries: string[]
): string => {
  const componentContextId = `__component_${compiler.nextCompilerId()}`;
  const propEntries = args
    .map((arg) => `${JSON.stringify(String(arg.value))}: l_${String(arg.value)}`)
    .join(', ');
  const propsCode = propEntries === '' ? '{ ...__props }' : `{ ${propEntries}, ...__props }`;
  compiler.emitLines(
    'const { slots: __slots, keywords: __keywords, ...__props } = kwargs;',
    `let ${componentContextId} = runtime.createComponentContext(${propsCode}, runtime.createSlotContext({ ${fallbackEntries.join(', ')} }, __slots));`,
    'for (const [__k, __v] of Object.entries(__props)) { if (__v !== undefined) frame = frame.set({ name: __k, value: __v }); }',
    `frame = frame.set({ name: "slot", value: ${componentContextId}.slots });`,
    `frame = frame.set({ name: "children", value: ${componentContextId}.slots("default") });`
  );
  return componentContextId;
};

const compileComponent = (compiler: Compiler, node: ComponentNode): string => {
  const { args, kwargs } = extractComponentArgs(compiler, node);
  const funcId = `component_${compiler.nextCompilerId()}`;
  const { argNames, kwargNames, realNames } = buildComponentArgNames(args, kwargs);

  const currFrame = createFrame();

  compiler.emitLines(
    `let ${funcId} = runtime.makeComponent({`,
    `argNames: [${argNames.join(', ')}], `,
    `kwargNames: [${kwargNames.join(', ')}], `,
    `func: async (${realNames.join(', ')}) => {`,
    'let outerFrame = frame;',
    'frame = runtime.createFrame();',
    'kwargs ??= {};'
  );

  emitComponentArgBindings(compiler, { args, kwargs, frame: currFrame });

  const fallbackEntries = emitFallbackEntries(compiler, node.fallbackSlots ?? [], currFrame);
  const componentContextId = emitComponentContext(compiler, args, fallbackEntries);

  currFrame.set({ name: 'slot', value: `${componentContextId}.slots` });
  currFrame.set({ name: 'children', value: `${componentContextId}.slots("default")` });

  const bufferId = compiler.pushBuffer();

  compiler.withScopedSyntax(() => {
    compiler.compile(node.body, currFrame);
  });

  compiler.emitLine('frame = outerFrame;');
  compiler.emitLine(`return runtime.createSafeString(${bufferId});`);
  compiler.emitLine('}});');
  compiler.popBuffer();

  return funcId;
};

export const compileComponentPublic = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<ComponentNode>
): void => {
  const funcId = compileComponent(compiler, node);

  const name = node.name;
  frame.set({ name, value: funcId });

  if (frame.parent) {
    compiler.emitLine(`frame = frame.set({ name: ${JSON.stringify(name)}, value: ${funcId} });`);
  } else {
    if (name[0] !== '_') {
      compiler.emitLine(`context = context.addExport(${JSON.stringify(name)});`);
    }
    compiler.emitLine(`context = context.setVariable(${JSON.stringify(name)}, ${funcId});`);
  }
};
