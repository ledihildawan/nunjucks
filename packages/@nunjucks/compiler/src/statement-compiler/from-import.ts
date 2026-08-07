import { isPair } from '@nunjucks/nodes';
import type { FromImportNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';
import { compileGetTemplate } from './import.ts';

export const compileFromImport = (compiler: Compiler, node: FromImportNode, frame: Frame): void => {
  const importedId = compileGetTemplate(compiler, node, frame, { eagerCompile: false, ignoreMissing: false });

  const withContextArg = node.withContext ? 'context.getVariables(), frame' : '';
  compiler.emitLine(`let ${importedId}_exported = await ${importedId}.getExported(` +
    withContextArg +
    ');');

  const namesChildren = node.names.children;
  forEach(namesChildren, nameNode => {
    let name: string;
    let alias: string;
    if (isPair(nameNode)) {
      const key = nameNode.key;
      name = typeof key === 'string' ? key : (key.value as string);
      alias = nameNode.value.value as string;
    } else {
      name = nameNode.value as string;
      alias = name;
    }
    const id = compiler.tmpid();

    compiler.emitLine(`let ${id};`);
    compiler.emitLine(`if(Object.hasOwn(${importedId}_exported, "${name}")) {`);
    compiler.emitLine(`${id} = ${importedId}_exported["${name}"];`);
    compiler.emitLine('} else {');
    compiler.emitLine(`throw new Error("Cannot import '${name}' from module");`);
    compiler.emitLine('}');

    frame.set(alias, id);

    if (frame.parent) {
      compiler.emitLine(`frame.set("${alias}", ${id});`);
    } else {
      compiler.emitLine(`context.setVariable("${alias}", ${id});`);
    }
  });
};
