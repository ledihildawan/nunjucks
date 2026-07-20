import { nodes } from '../../nodes/index.js';

export const compileTemplateData = (ctx, node, frame) => {
  ctx._emit(`${ctx.buffer} += `);
  ctx._emit(JSON.stringify(node.value));
  ctx._emit(';');
};

export const compileCapture = (ctx, node, frame) => {
  const buffer = ctx.buffer;
  ctx.buffer = 'output';
  ctx._emitLine('(async () => {');
  ctx._emitLine('let output = "";');
  ctx._withScopedSyntax(() => {
    ctx.compile(node.body, frame);
  });
  ctx._emitLine('return output;');
  ctx._emitLine('})()');
  ctx.buffer = buffer;
};

const extractVarName = (node) => {
  if (!node) return null;

  if (nodes.isSymbol(node)) {
    return node.value;
  }

  if (nodes.isLookupVal(node)) {
    const base = extractVarName(node.target);
    if (!base) return null;
    const prop = node.val?.value || node.val?.name || '';
    return `${base}.${prop}`;
  }

  return null;
};

const extractLocation = (node) => {
  if (!node) return { lineno: null, colno: null };

  if (nodes.isLookupVal(node) && node.val?.lineno != null && node.val?.colno != null) {
    return { lineno: node.val.lineno, colno: node.val.colno };
  }

  return { lineno: node.lineno, colno: node.colno };
};

export const compileOutput = (ctx, node, frame) => {
  const children = node.children;
  children.forEach(child => {
    if (nodes.isTemplateData(child)) {
      if (child.value) {
        ctx._emit(`${ctx.buffer} += `);
        ctx._emit(JSON.stringify(child.value));
        ctx._emit(';');
      }
    } else if (nodes.isVariableDeclaration(child) || nodes.isVariableAssignment(child)) {
      ctx.compile(child, frame);
    } else {
      const isPipeType = nodes.isPipe(child) || nodes.isPipeAsync(child);
      const isOptionalChainType = nodes.isOptionalChain(child) || nodes.isOptionalCall(child);
      const varName = extractVarName(child);
      const errorLocation = extractLocation(child);
      const undefinedMode = ctx.undefinedMode;

      const useEnsureDefined = !isOptionalChainType || undefinedMode === 'debug';
      const effectiveMode = undefinedMode;

      ctx._emitLineWithLineno(
        `lineno = ${errorLocation.lineno}; colno = ${errorLocation.colno}; ${ctx.buffer} += runtime.suppressValue(`,
        errorLocation.lineno,
        errorLocation.colno
      );
      if (!isPipeType) {
        ctx._emit('await runtime.awaitValue(');
      }
      if (useEnsureDefined) {
        ctx._emit('runtime.ensureDefined(');
      }
      ctx.compile(child, frame);
      if (useEnsureDefined) {
        const nameArg = varName ? `, "${varName}"` : ', null';
        const modeArg = effectiveMode ? `, "${effectiveMode}"` : '';
        ctx._emit(`,${errorLocation.lineno},${errorLocation.colno}${nameArg}, null${modeArg})`);
      }
      if (!isPipeType) {
        ctx._emit(')');
      }
      ctx._emit(', env.opts.autoescape);');
    }
  });
  ctx._emit('\n');
};
