import { createLog } from '@nunjucks/log';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { nodes } from '../../nodes/index.js';
import { compileDestructuring } from './pattern.js';

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

const hasPatternTarget = (node) => {
  return node.targets.some(t =>
    nodes.isArrayPattern(t) || nodes.isObjectPattern(t)
  );
};

export const compileSet = (ctx, node, frame) => {
  if (hasPatternTarget(node) && !node.body && !node.operator) {
    if (node.targets.length > 1) {
      throw createLog('error', ERROR_DEFINITIONS.SANDBOX_SET, { key: 'destructuring' }, 'destructuring', {
        lineno: node.lineno,
        colno: node.colno,
        phase: 'compile',
        lineBase: 'zero'
      });
    }
    const pattern = node.targets[0];
    const valueId = ctx._tmpid();
    ctx._emitLine(`let ${valueId} = `);
    ctx._compileExpression(node.value, frame);
    ctx._emitLine(';');
    compileDestructuring(ctx, frame, pattern, valueId);
    return;
  }

  const ids = [];
  const targets = node.targets.map(getSetTarget);
  const isCompoundAssignment = node.operator && node.operator !== '=';

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

    if (isCompoundAssignment) {
      const id = ctx._tmpid();
      ctx._emitLine('let ' + id + ' = runtime.contextOrFrameLookup(context, frame, "' + name + '");');
      ids.push(id);
    } else {
      let id = frame.lookup(name);

      if (id === null || id === undefined) {
        id = ctx._tmpid();
        ctx._emitLine('let ' + id + ';');
      }

      ids.push(id);
    }
  });

  if (node.value) {
    let op = node.operator || '=';
    if (op === ':=') {
      op = '=';
    }
    if (op === '//=') {
      ctx._emit(ids.join(' = ') + ' = Math.floor(' + ids.join(' = ') + ' / ');
      ctx._compileExpression(node.value, frame);
      ctx._emitLine(');');
    } else {
      ctx._emit(ids.join(' = ') + ' ' + op + ' ');
      ctx._compileExpression(node.value, frame);
      ctx._emitLine(';');
    }
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
