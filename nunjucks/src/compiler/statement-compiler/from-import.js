import { Pair } from '../../nodes.js';
import { compileGetTemplate } from './import.js';

export const compileFromImport = (ctx, node, frame) => {
  const importedId = compileGetTemplate(ctx, node, frame, false, false);

  ctx._emitLine(`var ${importedId}_exported = await ${importedId}.getExported(` +
    (node.withContext ? 'context.getVariables(), frame' : '') +
    ');');

  node.names.children.forEach((nameNode) => {
    let name;
    let alias;
    const id = ctx._tmpid();

    if (nameNode instanceof Pair) {
      name = nameNode.key.value;
      alias = nameNode.value.value;
    } else {
      name = nameNode.value;
      alias = name;
    }

    ctx._emitLine(`if(Object.prototype.hasOwnProperty.call(${importedId}_exported, "${name}")) {`);
    ctx._emitLine(`var ${id} = ${importedId}_exported["${name}"];`);
    ctx._emitLine('} else {');
    ctx._emitLine(`throw new Error("cannot import '${name}'");`);
    ctx._emitLine('}');

    frame.set(alias, id);

    if (frame.parent) {
      ctx._emitLine(`frame.set("${alias}", ${id});`);
    } else {
      ctx._emitLine(`context.setVariable("${alias}", ${id});`);
    }
  });
};
