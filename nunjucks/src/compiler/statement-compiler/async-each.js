import { ArrayNode } from '../../nodes/index.js';
import { emitLoopBindings } from './for.js';

const compileAsyncEachLoop = (ctx, node, frame, arr, i, len) => {
  const loopId = ctx._tmpid();

  if (node.name?.typename === 'Array') {
    const isObj = ctx._tmpid();
    const arrLen = ctx._tmpid();
    ctx._emitLine(`var ${isObj} = !runtime.isArray(${arr});`);
    ctx._emitLine(`var ${arrLen} = ${isObj} ? (${arr} ? runtime.keys(${arr}).length : 0) : (${arr} ? ${arr}.length : 0);`);
    ctx._emitLine(`var ${len} = ${arrLen};`);
    ctx._emitLine(`for (var ${i}=0; ${i}<${len}; ${i}++) {`);
    ctx._emitLine(`var ${loopId} = ${isObj} ? runtime.keys(${arr})[${i}] : ${i};`);

    node.name.children.forEach((name, idx) => {
      const id = name.value;
      if (idx === 0) {
        ctx._emitLine(`var ${id} = ${isObj} ? ${loopId} : ${arr}[${loopId}][${idx}];`);
      } else if (idx === 1) {
        ctx._emitLine(`var ${id} = ${isObj} ? ${arr}[${loopId}] : ${arr}[${loopId}][${idx}];`);
      } else {
        ctx._emitLine(`var ${id} = ${arr}[${loopId}][${idx}];`);
      }
      ctx._emitLine(`frame.set("${id}", ${id});`);
      frame.set(id, id);
    });
  } else {
    const id = node.name.value;
    ctx._emitLine(`var ${len} = ${arr} ? ${arr}.length : 0;`);
    ctx._emitLine(`for (var ${i}=0; ${i}<${len}; ${i}++) {`);
    ctx._emitLine(`var ${id} = ${arr}[${i}];`);
    ctx._emitLine('frame.set("' + id + '", ' + id + ');');
    frame.set(id, id);
  }

  emitLoopBindings(ctx, arr, i, len);

  ctx._withScopedSyntax(() => {
    ctx.compile(node.body, frame);
  });

  ctx._emitLine('}');
};

const compileAsyncAllLoop = (ctx, node, frame, arr, i, len) => {
  const loopId = ctx._tmpid();
  ctx._pushBuffer();
  const resultsVar = ctx._tmpid();

  ctx._emitLine(`var ${resultsVar} = [];`);

  if (node.name ?.typename === 'Array') {
    const isObj = ctx._tmpid();
    const arrLen = ctx._tmpid();
    ctx._emitLine(`var ${isObj} = !runtime.isArray(${arr});`);
    ctx._emitLine(`var ${arrLen} = ${isObj} ? (${arr} ? runtime.keys(${arr}).length : 0) : (${arr} ? ${arr}.length : 0);`);
    ctx._emitLine(`var ${len} = ${arrLen};`);
    ctx._emitLine(`for (var ${i}=0; ${i}<${len}; ${i}++) {`);
    ctx._emitLine(`var ${loopId} = ${isObj} ? runtime.keys(${arr})[${i}] : ${i};`);

    node.name.children.forEach((name, idx) => {
      const id = name.value;
      if (idx === 0) {
        ctx._emitLine(`var ${id} = ${isObj} ? ${loopId} : ${arr}[${loopId}][${idx}];`);
      } else if (idx === 1) {
        ctx._emitLine(`var ${id} = ${isObj} ? ${arr}[${loopId}] : ${arr}[${loopId}][${idx}];`);
      } else {
        ctx._emitLine(`var ${id} = ${arr}[${loopId}][${idx}];`);
      }
      ctx._emitLine(`frame.set("${id}", ${id});`);
      frame.set(id, id);
    });
  } else {
    const id = node.name.value;
    ctx._emitLine(`var ${len} = ${arr} ? ${arr}.length : 0;`);
    ctx._emitLine(`for (var ${i}=0; ${i}<${len}; ${i}++) {`);
    ctx._emitLine(`var ${id} = ${arr}[${i}];`);
    ctx._emitLine('frame.set("' + id + '", ' + id + ');');
    frame.set(id, id);
  }

  emitLoopBindings(ctx, arr, i, len);

  ctx._withScopedSyntax(() => {
    const itemBuf = ctx._tmpid();
    ctx._emitLine(`var ${itemBuf} = "";`);
    const savedBuffer = ctx.buffer;
    ctx.buffer = itemBuf;
    ctx.compile(node.body, frame);
    ctx.buffer = savedBuffer;
    ctx._emitLine(`${resultsVar}.push(${itemBuf});`);
  });

  ctx._emitLine('}');
  ctx._popBuffer();

  ctx._emitLine(`for (var ${i}=0; ${i}<${resultsVar}.length; ${i}++) {`);
  ctx._emitLine(`${ctx.buffer} += ${resultsVar}[${i}];`);
  ctx._emitLine('}');
};

const compileAsyncLoop = (ctx, node, frame, parallel) => {
  const i = ctx._tmpid();
  const len = ctx._tmpid();
  const arr = ctx._tmpid();
  frame = frame.push();

  ctx._emitLine('frame = frame.push();');

  ctx._emit('var ' + arr + ' = runtime.fromIterator(');
  ctx._compileExpression(node.arr, frame);
  ctx._emitLine(');');

  if (parallel) {
    compileAsyncAllLoop(ctx, node, frame, arr, i, len);
  } else {
    compileAsyncEachLoop(ctx, node, frame, arr, i, len);
  }

  if (node.else_) {
    ctx._emitLine('if (!' + arr + '.length) {');
    ctx.compile(node.else_, frame);
    ctx._emitLine('}');
  }

  ctx._emitLine('frame = frame.pop();');
};

export const compileAsyncEach = (ctx, node, frame) => {
  compileAsyncLoop(ctx, node, frame);
};

export const compileAsyncAll = (ctx, node, frame) => {
  compileAsyncLoop(ctx, node, frame, true);
};
