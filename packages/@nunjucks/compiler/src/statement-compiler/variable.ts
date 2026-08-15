import type { CompoundAssignNode, Node, VariableDeclNode } from '@nunjucks/nodes';
import { isArrayPattern, isObjectPattern, isSymbol } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import { assertSafeIdentifier, emitLocationGuard } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { compileDestructuring } from './pattern.ts';

const getTargetName = (target: Node | undefined): string | null => {
  if (!target) {
    return null;
  }
  if (isSymbol(target) || typeof target?.value === 'string') {
    return target.value as string;
  }
  return null;
};

const hasPatternTarget = (node: VariableDeclNode): boolean => {
  const targets = node.targets;
  return Boolean(targets) && targets.some((t) => isArrayPattern(t) || isObjectPattern(t));
};

const compileVariableDeclaration = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<VariableDeclNode>
): void => {
  if (hasPatternTarget(node)) {
    const valueId = compiler.nextCompilerId();
    compiler.emitLine(`let ${valueId} = `);
    compiler.compileExpression(node.value, frame);
    compiler.emitLine(';');

    forEach(node.targets, (pattern) => {
      compileDestructuring({ compiler, frame, registerFrame: true }, pattern, valueId);
    });
  } else {
    const targets = node.targets;
    const name = getTargetName(targets[0]);
    const valueId = compiler.nextCompilerId();

    compiler.emitLine(`let ${valueId} = `);
    compiler.compileExpression(node.value, frame);
    compiler.emitLine(';');

    if (name !== null) {
      compiler.emitLine(
        `frame = frame.set({ name: ${JSON.stringify(name)}, value: ${valueId}, resolveUp: true });`
      );
    }
  }
};

const compileVariableAssignment = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<VariableDeclNode>
): void => {
  if (hasPatternTarget(node)) {
    const valueId = compiler.nextCompilerId();
    compiler.emitLine(`let ${valueId} = `);
    compiler.compileExpression(node.value, frame);
    compiler.emitLine(';');

    forEach(node.targets, (pattern) => {
      compileDestructuring({ compiler, frame, registerFrame: true }, pattern, valueId);
    });
  } else {
    const targets = node.targets;
    const name = getTargetName(targets[0]);

    if (name !== null) {
      // WHY: defense-in-depth — `name` originates from a lexer `symbol` token (DELIM_CHARS blocks the run), but we still validate the identifier before emitting it into the generated source. String interpolation inside the ReferenceError message escapes through JSON.stringify so the embedded `${name}` cannot break out of the generated double-quoted string.
      assertSafeIdentifier(name, { compiler, lineno: node.lineno, colno: node.colno });
      const referenceErrorMessage = `Variable '${name}' is not defined. Use ${name} := value to declare it.`;
      compiler.emitLine(
        `if (frame.lookup(${JSON.stringify(name)}) === undefined) { throw new ReferenceError(${JSON.stringify(referenceErrorMessage)}); }`
      );

      const valueId = compiler.nextCompilerId();
      compiler.emitLine(`let ${valueId} = `);
      compiler.compileExpression(node.value, frame);
      compiler.emitLine(';');

      compiler.emitLine(
        `frame = frame.set({ name: ${JSON.stringify(name)}, value: ${valueId}, resolveUp: true });`
      );
    }
  }
};

const getCompoundOpJs = (operator: string): string | null => {
  switch (operator) {
    case '||=':
      return '||';
    case '&&=':
      return '&&';
    case '??=':
      return '??';
    case '**=':
      return '**';
    case '+=':
      return '+';
    case '-=':
      return '-';
    case '*=':
      return '*';
    case '/=':
      return '/';
    case '%=':
      return '%';
    default:
      return null;
  }
};

interface CompoundAssignEmitInput {
  compiler: Compiler;
  node: CompoundAssignNode;
  frame: Frame;
  currentId: string;
  valueId: string;
}

interface FilterAssignInput extends CompoundAssignEmitInput {
  key: string;
}

const emitFloorDivAssignment = ({
  compiler,
  node,
  frame,
  currentId,
  valueId,
}: CompoundAssignEmitInput): void => {
  compiler.emit(`let ${valueId} = Math.floor(${currentId} / `);
  compiler.compileExpression(node.value, frame);
  compiler.emit(');');
};

const emitFilterAssignment = ({
  compiler,
  node,
  frame,
  currentId,
  valueId,
}: FilterAssignInput): void => {
  const valueNode = node.value;
  const filterName = valueNode.type === 'symbol' ? (valueNode.value as string) : null;
  if (filterName) {
    compiler.emit(
      `let ${valueId} = await (async () => { const r = await runtime.runFilter({ env, name: ${JSON.stringify(filterName)}, lineno: ${node.lineno ?? 0}, colno: ${node.colno ?? 0}, context, args: [${currentId}] }); if (!r.ok) { throw r.error; } return r.value; })();`
    );
  } else {
    compiler.emit(`let ${valueId} = await runtime.awaitValue(`);
    compiler.compileExpression(valueNode, frame);
    compiler.emit(`, ${currentId});`);
  }
};

const emitGenericCompoundAssignment = ({
  compiler,
  node,
  frame,
  currentId,
  valueId,
}: CompoundAssignEmitInput): void => {
  const compoundOp = getCompoundOpJs(node.operator);
  if (compoundOp === null) {
    compiler.fail(`Unsupported compound operator: ${node.operator}`, node.lineno, node.colno);
  }
  compiler.emit(`let ${valueId} = ${currentId} ${compoundOp} `);
  compiler.compileExpression(node.value, frame);
  compiler.emit(';');
};

const compileCompoundAssignment = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<CompoundAssignNode>
): void => {
  const targets = node.targets;
  const name = getTargetName(targets[0]);
  if (name === null) {
    compiler.fail('Compound assignment requires a named target', node.lineno, node.colno);
    return;
  }

  const key = JSON.stringify(name);
  const currentId = compiler.nextCompilerId();
  const valueId = compiler.nextCompilerId();

  emitLocationGuard(compiler, node.lineno ?? 0, node.colno ?? 0);
  compiler.emit('(() => {');
  compiler.emit(`let ${currentId} = runtime.contextOrFrameLookup(context, frame, ${key});`);

  if (node.operator === '//=') {
    emitFloorDivAssignment({ compiler, node, frame, currentId, valueId });
  } else if (node.operator === '|>=') {
    emitFilterAssignment({ compiler, node, frame, currentId, valueId, key });
  } else {
    emitGenericCompoundAssignment({ compiler, node, frame, currentId, valueId });
  }

  compiler.emit(`frame = frame.set({ name: ${key}, value: ${valueId}, resolveUp: true });`);
  compiler.emit(`context = context.setVariable(${key}, ${valueId});`);
  compiler.emit(`return ${valueId};`);
  compiler.emit('})())');
};

export { compileCompoundAssignment, compileVariableAssignment, compileVariableDeclaration };
