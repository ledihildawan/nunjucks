import { isPair } from '@nunjucks/nodes';
import type { FromImportNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';
import { compileGetTemplate } from './import.ts';

export const compileFromImport = (ctx: Compiler, node: FromImportNode, frame: Frame): void => {
  const importedId = compileGetTemplate(ctx, node, frame, { eagerCompile: false, ignoreMissing: false });

  const withContextArg = node.withContext ? 'context.getVariables(), frame' : '';
  ctx.emitLine(`let ${importedId}_exported = await ${importedId}.getExported(` +
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
    const id = ctx.tmpid();

    ctx.emitLine(`let ${id};`);
    ctx.emitLine(`if(Object.hasOwn(${importedId}_exported, "${name}")) {`);
    ctx.emitLine(`${id} = ${importedId}_exported["${name}"];`);
    ctx.emitLine('} else {');
    ctx.emitLine(`throw new Error("Cannot import '${name}' from module");`);
    ctx.emitLine('}');

    frame.set(alias, id);

    if (frame.parent) {
      ctx.emitLine(`frame.set("${alias}", ${id});`);
    } else {
      ctx.emitLine(`context.setVariable("${alias}", ${id});`);
    }
  });
};
