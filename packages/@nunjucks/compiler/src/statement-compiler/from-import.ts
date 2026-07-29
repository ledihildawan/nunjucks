import { isPair } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';
import { compileGetTemplate } from './import.ts';

export const compileFromImport = (ctx: Compiler, node: Node, frame: Frame): void => {
  const importedId = compileGetTemplate(ctx, node, frame, { eagerCompile: false, ignoreMissing: false });

  const withContextArg = node.withContext ? 'context.getVariables(), frame' : '';
  ctx.emitLine(`let ${importedId}_exported = await ${importedId}.getExported(` +
    withContextArg +
    ');');

  const namesChildren = (node.names as Node).children as Node[];
  forEach(namesChildren, nameNode => {
    const isPairNode = isPair(nameNode);
    const name = (isPairNode ? (nameNode.key as Node).value : nameNode.value) as string;
    const alias = isPairNode ? (nameNode.value as Node).value as string : name;
    const id = ctx.tmpid();

    ctx.emitLine(`if(Object.prototype.hasOwnProperty.call(${importedId}_exported, "${name}")) {`);
    ctx.emitLine(`let ${id} = ${importedId}_exported["${name}"];`);
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
