import { ERROR_CODES } from '@nunjucks/error-catalog';
import type { CompoundAssignNode, Node, VariableDeclNode } from '@nunjucks/nodes';
import { isArrayPattern, isObjectPattern, isSymbol } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { assertSafeIdentifier, emitLocationGuard } from '../codegen.ts';
import type { Compiler } from '../create-compiler.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { compileDestructuring } from './pattern.ts';

const getTargetName = (target: Node | undefined): string | null => {
  if (!target) {
    return null;
  }
  if (isSymbol(target) || typeof target.value === 'string') {
    return String(target.value);
  }
  return null;
};

const hasPatternTarget = (node: VariableDeclNode): boolean => {
  const targets = node.targets;
  return Boolean(targets) && targets.some((t) => isArrayPattern(t) || isObjectPattern(t));
};

/**
 * Compiles `{% set %}` declarations: pattern targets destructure the value
 * temporary, plain names bind it into the frame with `resolveUp`.
 */
const compileVariableDeclaration = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<VariableDeclNode>
): void => {
  if (hasPatternTarget(node)) {
    const valueId = compiler.nextCompilerId();
    compiler.emitLine(`let ${valueId} = `);
    compiler.compileExpression(node.value, frame);
    compiler.emitLine(';');

    for (const pattern of node.targets) {
      compileDestructuring({ compiler, frame }, pattern, valueId);
    }
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

/**
 * Compiles `{% = %}` assignments: named targets first emit a coded
 * `ReferenceError` guard for undeclared variables, then rebind the value
 * with `resolveUp`; pattern targets destructure instead.
 */
const compileVariableAssignment = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<VariableDeclNode>
): void => {
  if (hasPatternTarget(node)) {
    const valueId = compiler.nextCompilerId();
    compiler.emitLine(`let ${valueId} = `);
    compiler.compileExpression(node.value, frame);
    compiler.emitLine(';');

    for (const pattern of node.targets) {
      compileDestructuring({ compiler, frame }, pattern, valueId);
    }
  } else {
    const targets = node.targets;
    const name = getTargetName(targets[0]);

    if (name !== null) {
      // WHY: defense-in-depth — `name` originates from a lexer `symbol` token (DELIM_CHARS blocks the run), but we still validate the identifier before emitting it into the generated source. String interpolation inside the ReferenceError message escapes through JSON.stringify so the embedded `${name}` cannot break out of the generated double-quoted string.
      assertSafeIdentifier(name, { compiler, lineno: node.lineno, colno: node.colno });
      const referenceErrorMessage = `Variable '${name}' is not defined. Use ${name} := value to declare it.`;
      // WHY: the attached code lets the error funnel classify this throw as UNDEFINED_VARIABLE
      // (causes/fixCode/docs) instead of degrading to the generic RUNTIME_ERROR definition.
      compiler.emitLine(
        `if (frame.lookup(${JSON.stringify(name)}) === undefined) { const referenceError = new ReferenceError(${JSON.stringify(referenceErrorMessage)}); referenceError.code = ${JSON.stringify(ERROR_CODES.UNDEFINED_VARIABLE)}; throw referenceError; }`
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
}: CompoundAssignEmitInput): void => {
  const valueNode = node.value;
  const filterName = valueNode.type === 'symbol' ? String(valueNode.value) : null;
  if (filterName) {
    compiler.emit(
      `let ${valueId} = await (async () => { const r = await runtime.runFilter({ env, name: ${JSON.stringify(filterName)}, lineno: ${node.lineno}, colno: ${node.colno}, context, args: [${currentId}] }); if (!r.ok) { throw r.error; } return r.value; })();`
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
    compiler.fail({
      message: `Unsupported compound operator: ${node.operator}`,
      lineno: node.lineno,
      colno: node.colno,
    });
  }
  compiler.emit(`let ${valueId} = ${currentId} ${compoundOp} `);
  compiler.compileExpression(node.value, frame);
  compiler.emit(';');
};

/**
 * Compiles `+=`-style compound assignments (and `//=`/`|>=` variants) to an
 * IIFE reading the current value, computing the update, and writing it back
 * to both `frame` and `context`.
 */
const compileCompoundAssignment = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<CompoundAssignNode>
): void => {
  const targets = node.targets;
  const name = getTargetName(targets[0]);
  if (name === null) {
    compiler.fail({
      message: 'Compound assignment requires a named target',
      lineno: node.lineno,
      colno: node.colno,
    });
    return;
  }

  assertSafeIdentifier(name, { compiler, lineno: node.lineno, colno: node.colno });
  const key = JSON.stringify(name);
  const currentId = compiler.nextCompilerId();
  const valueId = compiler.nextCompilerId();

  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.emit('(() => {');
  compiler.emit(`let ${currentId} = runtime.contextOrFrameLookup(context, frame, ${key});`);

  if (node.operator === '//=') {
    emitFloorDivAssignment({ compiler, node, frame, currentId, valueId });
  } else if (node.operator === '|>=') {
    emitFilterAssignment({ compiler, node, frame, currentId, valueId });
  } else {
    emitGenericCompoundAssignment({ compiler, node, frame, currentId, valueId });
  }

  compiler.emit(`frame = frame.set({ name: ${key}, value: ${valueId}, resolveUp: true });`);
  compiler.emit(`context = context.setVariable(${key}, ${valueId});`);
  compiler.emit(`return ${valueId};`);
  compiler.emit('})())');
};

export { compileCompoundAssignment, compileVariableAssignment, compileVariableDeclaration };
