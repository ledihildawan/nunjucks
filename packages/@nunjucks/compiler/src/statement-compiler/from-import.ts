import type { FromImportNode, Node } from '@nunjucks/nodes';
import { isPair } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import { assertSafeIdentifier } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { compileGetTemplate } from './template-lookup.ts';

const extractNameAlias = (nameNode: Node): { name: string; alias: string } => {
  if (isPair(nameNode)) {
    const key = nameNode.key;
    const name = typeof key === 'string' ? key : (key.value as string);
    return { name, alias: nameNode.value.value as string };
  }
  const name = nameNode.value as string;
  return { name, alias: name };
};

interface CompileImportedNameOptions {
  compiler: Compiler;
  nameNode: Node;
  importedId: string;
  frame: Frame;
}

const compileImportedName = ({
  compiler,
  nameNode,
  importedId,
  frame,
}: CompileImportedNameOptions): void => {
  const { name, alias } = extractNameAlias(nameNode);
  assertSafeIdentifier(name, { compiler });
  assertSafeIdentifier(alias, { compiler });
  const id = compiler.nextCompilerId();

  compiler.emitLine(`let ${id};`);
  compiler.emitLine(`if(Object.hasOwn(${importedId}_exported, ${JSON.stringify(name)})) {`);
  compiler.emitLine(`${id} = ${importedId}_exported[${JSON.stringify(name)}];`);
  compiler.emitLine('} else {');
  // WHY: the attached code lets the error funnel classify this throw as IMPORT_ERROR
  // (causes/fixCode/docs) instead of degrading to the generic RUNTIME_ERROR definition.
  compiler.emitLine(
    `const importError = new Error('Cannot import ' + ${JSON.stringify(name)} + ' from module'); importError.code = 'IMPORT_ERROR'; importError.subject = ${JSON.stringify(name)}; throw importError;`
  );
  compiler.emitLine('}');

  frame.set({ name: alias, value: id });

  if (frame.parent) {
    compiler.emitLine(`frame = frame.set({ name: ${JSON.stringify(alias)}, value: ${id} });`);
  } else {
    compiler.emitLine(`context = context.setVariable(${JSON.stringify(alias)}, ${id});`);
  }
};

export const compileFromImport = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<FromImportNode>
): void => {
  const importedId = compileGetTemplate({
    compiler,
    node,
    frame,
    options: {
      eagerCompile: false,
      ignoreMissing: false,
      includeChain: compiler.getTemplateName(),
    },
  });

  const withContextArg = node.withContext ? 'context.getVariables(), frame' : '';
  compiler.emitLine(
    `let ${importedId}_exported = await ${importedId}.getExported(${withContextArg});`
  );

  forEach(node.names.children, (nameNode) =>
    compileImportedName({ compiler, nameNode, importedId, frame })
  );
};
