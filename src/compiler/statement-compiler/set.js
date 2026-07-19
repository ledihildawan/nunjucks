import { createLog } from '@nunjucks/log';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { nodes } from '../../nodes/index.js';

const getSetTarget = (target) => {
  if (nodes.isSymbol(target) || typeof target?.value === 'string') {
    return {
      name: target.value,
      lineno: target.lineno,
      colno: target.colno,
      assignable: true
    };
  }

  if (nodes.isLookupVal(target)) {
    const key = target.val?.value ?? target.val?.name ?? target.value ?? 'property';
    return {
      name: String(key),
      lineno: target.val?.lineno ?? target.lineno,
      colno: target.val?.colno ?? target.colno,
      assignable: false
    };
  }

  return {
    name: target?.value ?? 'target',
    lineno: target?.lineno ?? null,
    colno: target?.colno ?? null,
    assignable: false
  };
};

export const compileSet = (ctx, node, frame) => {
  const ids = [];
  const targets = node.targets.map(getSetTarget);

  for (const target of targets) {
    if (!target.assignable) {
      throw createLog('error', ERROR_DEFINITIONS.SANDBOX_SET, { key: target.name }, target.name, {
        lineno: target.lineno,
        colno: target.colno,
        phase: 'compile',
        lineBase: 'zero'
      });
    }
  }

  targets.forEach((target) => {
    const name = target.name;
    let id = frame.lookup(name);

    if (id === null || id === undefined) {
      id = ctx._tmpid();
      ctx._emitLine('let ' + id + ';');
    }

    ids.push(id);
  });

  if (node.value) {
    const op = node.operator || '=';
    ctx._emit(ids.join(' = ') + ' ' + op + ' ');
    ctx._compileExpression(node.value, frame);
    ctx._emitLine(';');
  } else {
    ctx._emit(ids.join(' = ') + ' = await ');
    ctx.compile(node.body, frame);
    ctx._emitLine(';');
  }

  targets.forEach((target, i) => {
    const id = ids[i];
    const name = target.name;

    ctx._emitLine(`frame.set("${name}", ${id}, true);`);

    ctx._emitLine(`context.setVariable("${name}", ${id});`);

    if (name.charAt(0) !== '_') {
      ctx._emitLine('if(frame.topLevel) {');
      ctx._emitLine(`context.addExport("${name}", ${id});`);
      ctx._emitLine('}');
    }
  });
};
