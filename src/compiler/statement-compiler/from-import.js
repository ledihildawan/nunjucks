import { nodes } from '../../nodes/index.js';
import { compileGetTemplate } from './import.js';

export const compileFromImport = (ctx, node, frame) => {
  const importedId = compileGetTemplate(ctx, node, frame, false, false);

  ctx._emitLine(`let ${importedId}_exported = await ${importedId}.getExported(` +
    (node.withContext ? 'context.getVariables(), frame' : '') +
    ');');

  node.names.children.forEach((nameNode) => {
    let name;
    let alias;
    const id = ctx._tmpid();

    if (nodes.isPair(nameNode)) {
      name = nameNode.key.value;
      alias = nameNode.value.value;
    } else {
      name = nameNode.value;
      alias = name;
    }

    ctx._emitLine(`if(Object.prototype.hasOwnProperty.call(${importedId}_exported, "${name}")) {`);
    ctx._emitLine(`let ${id} = ${importedId}_exported["${name}"];`);
    ctx._emitLine('} else {');
    ctx._emitLine(`throw new Error("Cannot import '${name}' from module");`);
    ctx._emitLine('}');

    frame.set(alias, id);

    if (frame.parent) {
      ctx._emitLine(`frame.set("${alias}", ${id});`);
    } else {
      ctx._emitLine(`context.setVariable("${alias}", ${id});`);
    }
  });
};
