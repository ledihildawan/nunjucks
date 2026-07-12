import { Literal, isSymbol, isLiteral } from '../../nodes/index.js';

export const compileLiteral = (ctx, node) => {
  if (typeof node.value === 'string') {
    let val = node.value.replace(/\\/g, '\\\\');
    val = val.replace(/"/g, '\\"');
    val = val.replace(/\n/g, '\\n');
    val = val.replace(/\r/g, '\\r');
    val = val.replace(/\t/g, '\\t');
    val = val.replace(/\u2028/g, '\\u2028');
    ctx._emit(`"${val}"`);
  } else if (node.value === null) {
    ctx._emit('null');
  } else {
    ctx._emit(node.value.toString());
  }
};

export const compileSymbol = (ctx, node, frame) => {
  const name = node.value;
  const v = frame.lookup(name);

  if (v) {
    ctx._emit(v);
  } else {
    ctx._emit('runtime.contextOrFrameLookup(' +
      'context, frame, "' + name + '")');
  }
};

export const compileGroup = (ctx, node, frame) => {
  compileAggregate(ctx, node, frame, '(', ')');
};

export const compileArray = (ctx, node, frame) => {
  compileAggregate(ctx, node, frame, '[', ']');
};

export const compileDict = (ctx, node, frame) => {
  compileAggregate(ctx, node, frame, '{', '}');
};

export const compileNodeList = (ctx, node, frame) => {
  ctx._compileChildren(node, frame);
};

export const compilePair = (ctx, node, frame) => {
  let key = node.key;
  const val = node.value;

  if (isSymbol(key)) {
    key = Literal(key.lineno, key.colno, key.value);
  } else if (!(isLiteral(key) &&
    typeof key.value === 'string')) {
    ctx.fail('compilePair: Dict keys must be strings or names',
      key.lineno,
      key.colno);
  }

  ctx.compile(key, frame);
  ctx._emit(': ');
  ctx._compileExpression(val, frame);
};

export const compileKeywordArgs = (ctx, node, frame) => {
  ctx._emit('runtime.makeKeywordArgs(');
  compileDict(ctx, node, frame);
  ctx._emit(')');
};

export const compileAggregate = (ctx, node, frame, startChar, endChar) => {
  if (startChar) {
    ctx._emit(startChar);
  }

  node.children.forEach((child, i) => {
    if (i > 0) {
      ctx._emit(',');
    }
    ctx.compile(child, frame);
  });

  if (endChar) {
    ctx._emit(endChar);
  }
};
