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
      const varName = child.typename === 'Symbol' ? child.value : null;
      const useEnsureDefined = ctx.undefinedMode && ctx.undefinedMode !== 'chainable';
      ctx._emitLineWithLineno(`lineno = ${child.lineno}; colno = ${child.colno}; ${ctx.buffer} += runtime.suppressValue(`, child.lineno, child.colno);
      if (!isPipe) {
        ctx._emit('await runtime.awaitValue(');
      }
      if (useEnsureDefined) {
        ctx._emit('runtime.ensureDefined(');
      }
      ctx.compile(child, frame);
      if (useEnsureDefined) {
        const nameArg = varName ? `, "${varName}"` : '';
        const modeArg = ctx.undefinedMode ? `, "${ctx.undefinedMode}"` : '';
        ctx._emit(`,${child.lineno},${child.colno}${nameArg}${modeArg})`);
      }
      if (!isPipe) {
        ctx._emit(')');
      }
      ctx._emit(', env.opts.autoescape);');
    }
  });
  ctx._emit('\n');
};
