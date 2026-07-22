import { isPair } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { compileGetTemplate } from './import.ts';

export const compileFromImport = (ctx: Compiler, node: Node, frame: Frame): void => {
  const importedId = compileGetTemplate(ctx, node, frame, false, false);

  ctx.emitLine(`let ${importedId}_exported = await ${importedId}.getExported(` +
    (node.withContext ? 'context.getVariables(), frame' : '') +
    ');');

  const namesChildren = (node.names as Node).children as Node[];
  namesChildren.forEach((nameNode) => {
    let name: string;
    let alias: string;
    const id = ctx.tmpid();

    if (isPair(nameNode)) {
      name = (nameNode.key as Node).value as string;
      alias = (nameNode.value as Node).value as string;
    } else {
      name = nameNode.value as string;
      alias = name;
    }

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
