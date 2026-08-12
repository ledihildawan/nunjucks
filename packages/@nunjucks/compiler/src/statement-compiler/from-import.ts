import { isPair } from '@nunjucks/nodes';
import type { FromImportNode, Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { compileGetTemplate } from './import.ts';

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

const compileImportedName = ({ compiler, nameNode, importedId, frame }: CompileImportedNameOptions): void => {
  const { name, alias } = extractNameAlias(nameNode);
  const id = compiler.tmpid();

  compiler.emitLine(`let ${id};`);
  compiler.emitLine(`if(Object.hasOwn(${importedId}_exported, "${name}")) {`);
  compiler.emitLine(`${id} = ${importedId}_exported["${name}"];`);
  compiler.emitLine('} else {');
  compiler.emitLine(`throw new Error("Cannot import '${name}' from module");`);
  compiler.emitLine('}');

  frame.set({ name: alias, value: id });

  if (frame.parent) {
    compiler.emitLine(`frame = frame.set({ name: "${alias}", value: ${id} });`);
  } else {
    compiler.emitLine(`context = context.setVariable("${alias}", ${id});`);
  }
};

export const compileFromImport = (compiler: Compiler, { node, frame }: CompileNodeInput<FromImportNode>): void => {
  const importedId = compileGetTemplate(compiler, node, frame, { eagerCompile: false, ignoreMissing: false, includeChain: compiler.getTemplateName() });

  const withContextArg = node.withContext ? 'context.getVariables(), frame' : '';
  compiler.emitLine(`let ${importedId}_exported = await ${importedId}.getExported(` +
    withContextArg +
    ');');

  forEach(node.names.children, nameNode => compileImportedName({ compiler, nameNode, importedId, frame }));
};
