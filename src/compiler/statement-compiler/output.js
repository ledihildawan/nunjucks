export const compileTemplateData = (ctx, node, frame) => {
  ctx._emit(`${ctx.buffer} += `);
  ctx._emit(JSON.stringify(node.value));
  ctx._emit(';');
};

export const compileCapture = (ctx, node, frame) => {
  const buffer = ctx.buffer;
  ctx.buffer = 'output';
  ctx._emitLine('(async function() {');
  ctx._emitLine('var output = "";');
  ctx._withScopedSyntax(() => {
    ctx.compile(node.body, frame);
  });
  ctx._emitLine('return output;');
  ctx._emitLine('})()');
  ctx.buffer = buffer;
};

const extractVarName = (node) => {
  if (!node) return null;

  if (node.typename === 'Symbol') {
    return node.value;
  }

  if (node.typename === 'LookupVal') {
    const base = extractVarName(node.target);
    if (!base) return null;
    const prop = node.val?.value || node.val?.name || '';
    return `${base}.${prop}`;
  }

  return null;
};

export const compileOutput = (ctx, node, frame) => {
  const children = node.children;
  children.forEach(child => {
    if (child.typename === 'TemplateData') {
      if (child.value) {
        ctx._emit(`${ctx.buffer} += `);
        ctx._emit(JSON.stringify(child.value));
        ctx._emit(';');
      }
    } else {
      const isPipe = child.typename === 'Pipe' || child.typename === 'PipeAsync';
      const isLookupVal = child.typename === 'LookupVal';
      const varName = extractVarName(child);
      const undefinedMode = ctx.undefinedMode;

      // LookupVal (e.g., user.name) in debug mode should throw error (not warning)
      const useEnsureDefined = undefinedMode && undefinedMode !== 'chainable';
      const shouldWarn = useEnsureDefined && !isLookupVal;
      const shouldError = useEnsureDefined && isLookupVal && undefinedMode === 'debug';

      // For LookupVal in debug mode, pass 'strict' to ensureDefined so it throws error
      const effectiveMode = (isLookupVal && undefinedMode === 'debug') ? 'strict' : undefinedMode;

      ctx._emitLineWithLineno(`lineno = ${child.lineno}; colno = ${child.colno}; ${ctx.buffer} += runtime.suppressValue(`, child.lineno, child.colno);
      if (!isPipe) {
        ctx._emit('await runtime.awaitValue(');
      }
      if (shouldWarn || shouldError) {
        ctx._emit('runtime.ensureDefined(');
      }
      ctx.compile(child, frame);
      if (shouldWarn || shouldError) {
        const nameArg = varName ? `, "${varName}"` : ', null';
        const modeArg = effectiveMode ? `, "${effectiveMode}"` : '';
        const escapedTemplateName = ctx.templateName ? ctx.templateName.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : null;
        const tmplArg = escapedTemplateName ? `, "${escapedTemplateName}"` : ', null';
        ctx._emit(`,${child.lineno},${child.colno}${nameArg}${tmplArg}${modeArg})`);
      }
      if (!isPipe) {
        ctx._emit(')');
      }
      ctx._emit(', env.opts.autoescape);');
    }
  });
  ctx._emit('\n');
};
