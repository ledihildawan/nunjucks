import { isArray } from 'remeda';
import { nodes } from '../nodes/index.js';

const { isSymbol, isLiteral, isPipe, isPipeAsync, isOutput, isTemplateData, isFor, isIf, isSet, isMacro, isBlock, isExtends, isInclude, isImport, isCall, isFilter } = nodes;

class CodeBuilder {
  constructor(options, name, sourceMap = null) {
    this.options = options;
    this.name = name;
    this.sourceMap = sourceMap;
    this.buffer = [];
    this.tempId = 0;
    this.frames = [];
    this.currentFrame = null;
    this.hasAsync = false;
    this.hasBlocks = false;
  }

  emit(code) {
    this.buffer.push(code);
  }

  emitLine(code, line = null) {
    this.buffer.push(code);
    this.buffer.push('\n');
  }

  emitLines(...lines) {
    lines.forEach(line => this.emitLine(line));
  }

  tmpid() {
    return `t_${this.tempId++}`;
  }

  pushFrame() {
    const frame = {
      vars: new Map(),
      parent: this.currentFrame
    };
    this.frames.push(frame);
    this.currentFrame = frame;
    return frame;
  }

  popFrame() {
    this.frames.pop();
    this.currentFrame = this.frames[this.frames.length - 1] || null;
  }

  setVar(name, value) {
    if (this.currentFrame) {
      this.currentFrame.vars.set(name, value);
    }
  }

  getVar(name) {
    let frame = this.currentFrame;
    while (frame) {
      if (frame.vars.has(name)) {
        return frame.vars.get(name);
      }
      frame = frame.parent;
    }
    return null;
  }

  hasVar(name) {
    return this.getVar(name) !== null;
  }
}

export function build(ast, options, name, sourceMap) {
  const builder = new CodeBuilder(options, name, sourceMap);
  return builder.build(ast);
}

CodeBuilder.prototype.build = function(node) {
  if (isArray(node)) {
    node.forEach(n => this.build(n));
    return this.buffer.join('');
  }

  const type = node.type;

  switch (type) {
    case 'root':
      return this.buildRoot(node);
    case 'output':
      return this.buildOutput(node);
    case 'templateData':
      return this.buildTemplateData(node);
    case 'symbol':
      return this.buildSymbol(node);
    case 'literal':
      return this.buildLiteral(node);
    case 'pipe':
      return this.buildPipe(node);
    case 'pipeAsync':
      return this.buildPipeAsync(node);
    case 'for':
      return this.buildFor(node);
    case 'if':
      return this.buildIf(node);
    case 'set':
      return this.buildSet(node);
    case 'block':
      return this.buildBlock(node);
    case 'extends':
      return this.buildExtends(node);
    case 'include':
      return this.buildInclude(node);
    case 'import':
      return this.buildImport(node);
    case 'macro':
      return this.buildMacro(node);
    case 'call':
      return this.buildCall(node);
    case 'filter':
      return this.buildFilterStatement(node);
    case 'lookupVal':
      return this.buildLookupVal(node);
    case 'optionalChain':
      return this.buildOptionalChain(node);
    case 'optionalCall':
      return this.buildOptionalCall(node);
    case 'array':
      return this.buildArray(node);
    case 'dict':
      return this.buildDict(node);
    case 'group':
      return this.buildGroup(node);
    case 'funCall':
      return this.buildFunCall(node);
    case 'add':
    case 'sub':
    case 'mul':
    case 'div':
    case 'mod':
    case 'concat':
    case 'floorDiv':
    case 'pow':
      return this.buildBinaryOp(node);
    case 'or':
    case 'and':
      return this.buildLogicalOp(node);
    case 'nullishCoalesce':
      return this.buildNullishCoalesce(node);
    case 'not':
      return this.buildUnaryNot(node);
    case 'neg':
    case 'pos':
      return this.buildUnaryOp(node);
    case 'compare':
      return this.buildCompare(node);
    case 'in':
      return this.buildIn(node);
    case 'slice':
      return this.buildSlice(node);
    case 'inlineIf':
      return this.buildInlineIf(node);
    default:
      throw new Error(`Unknown node type: ${type}`);
  }
};

CodeBuilder.prototype.buildRoot = function(node) {
  this.pushFrame();
  
  const asyncKeyword = this.options.async !== false ? 'async ' : '';
  const isStrict = this.options.undefined === 'strict';
  const isDebug = this.options.undefined === 'debug';
  
  // Modern 2026 style: export async function
  this.emitLine(`export ${asyncKeyword}function render(ctx, rt) {`);
  
  // Helper shorthand: $ for escape, _ for lookup
  this.emitLine(`  const $ = rt.escape;`);
  
  if (isDebug) {
    // Debug mode: return 'undefined' string when key exists but value is undefined
    this.emitLine(`  const _ = (k, d) => (k in ctx ? ctx[k] : d);`);
  } else if (isStrict) {
    // Strict mode: throw error when key doesn't exist or is undefined
    this.emitLine(`  const _ = (k, d) => { const v = ctx[k]; if (v === undefined) throw new Error('Undefined: ' + k); return v ?? d; };`);
  } else {
    // Chainable mode (default): use nullish coalescing
    this.emitLine(`  const _ = (k, d) => rt.lookup(ctx, k) ?? d;`);
  }
  
  // Raw lookup without default - for optional chaining
  this.emitLine(`  const __ = (k) => rt.lookup(ctx, k);`);
  
  if (isStrict) {
    this.emitLine(`  const require = (k) => { const v = ctx[k]; if (v === undefined) throw new Error('Undefined: ' + k); return v; };`);
  }
  
  this.emitLine(`  const f = rt.getFilter;`);
  this.emitLine(`  const autoescape = ctx._autoescape ?? true;`);
  this.emitLine(``);
  
  // Build return statement - use array join instead of template literal
  this.emitLine(`  const out = [];`);
  
  if (node.children) {
    node.children.forEach(child => this.build(child));
  }
  
  this.emitLine(``);
  this.emitLine(`  return out.join('');`);
  this.emitLine(`}`);

  this.popFrame();

  return this.buffer.join('');
};

CodeBuilder.prototype.buildOutput = function(node) {
  if (!node.children) return;

  node.children.forEach(child => {
    if (isTemplateData(child)) {
      this.buildTemplateData(child);
    } else {
      this.buildExpression(child);
    }
  });
};

CodeBuilder.prototype.buildTemplateData = function(node) {
  if (node.value) {
    const escaped = JSON.stringify(node.value);
    this.emitLine(`  out.push(${escaped});`);
  }
};

CodeBuilder.prototype.buildSymbol = function(node) {
  const varName = node.value;
  if (this.getVar(varName)) {
    return varName;
  }
  
  // Use rt.lookup for new format
  const lookup = `rt.lookup(ctx, "${varName}")`;
  
  // Use require if undefined mode is strict
  if (this.options.undefined === 'strict') {
    return `require("${varName}")`;
  }
  
  // Debug mode should return the string "undefined"
  if (this.options.undefined === 'debug') {
    return `(_('${varName}', 'undefined'))`;
  }
  
  return `(_('${varName}', ''))`;
};

CodeBuilder.prototype.buildLiteral = function(node) {
  return JSON.stringify(node.value);
};

CodeBuilder.prototype.buildExpression = function(node) {
  if (isSymbol(node)) {
    const symbolCode = this.buildSymbol(node);
    this.emitLine(`  out.push($(${symbolCode}));`);
  } else if (isLiteral(node)) {
    this.emitLine(`  out.push($(${this.buildLiteral(node)}));`);
  } else if (isPipe(node) || isPipeAsync(node)) {
    this.buildPipe(node);
  } else {
    this.emitLine(`  out.push($(${this.build(node)}));`);
  }
};

CodeBuilder.prototype.buildPipe = function(node) {
  const filterName = node.name?.value;
  const args = node.args?.children || [];
  
  const argsCode = args.map((arg) => this.build(arg)).join(', ');

  const awaitKw = this.options.async !== false ? 'await ' : '';
  
  // Use new format with f for getFilter
  if (awaitKw) {
    this.emitLine(`  out.push($(${awaitKw}f('${filterName}')(${argsCode})));`);
  } else {
    this.emitLine(`  out.push($(f('${filterName}')(${argsCode})));`);
  }
};

CodeBuilder.prototype.buildPipeAsync = function(node) {
  this.hasAsync = true;
  this.buildPipe(node);
};

CodeBuilder.prototype.buildLookupVal = function(node) {
  const targetCode = this.build(node.target);
  const valCode = this.build(node.val);
  return `rt.memberLookup(${targetCode}, ${valCode})`;
};

CodeBuilder.prototype.buildOptionalChain = function(node) {
  // For optional chain like user?.name, use __ for raw lookup
  let targetCode;
  if (node.target?.type === 'symbol') {
    targetCode = `__('${node.target.value}')`;
  } else {
    targetCode = this.build(node.target);
  }
  const valCode = this.build(node.val);
  return `rt.optionalMemberLookup(${targetCode}, ${valCode})`;
};

CodeBuilder.prototype.buildOptionalCall = function(node) {
  // For optional calls, we need to get the raw value to check if it's callable
  // Use __ for raw lookup (without default)
  let nameCode;
  if (node.name?.type === 'symbol') {
    nameCode = `__('${node.name.value}')`;
  } else {
    nameCode = this.build(node.name);
  }
  const argsCode = node.args?.children?.map(arg => this.build(arg)).join(', ') || '';
  return `(${nameCode}?.(${argsCode}) ?? '')`;
};

CodeBuilder.prototype.buildArray = function(node) {
  const elements = node.children?.map(child => this.build(child)).join(', ') || '';
  return `[${elements}].join(',')`;
};

CodeBuilder.prototype.buildDict = function(node) {
  const pairs = node.children?.map(child => {
    const key = child.key?.value || (child.key?.type === 'symbol' ? child.key.value : child.key);
    const val = this.build(child.value);
    return `${JSON.stringify(key)}: ${val}`;
  }).join(', ') || '';
  return `{${pairs}}`;
};

CodeBuilder.prototype.buildGroup = function(node) {
  // Group just wraps an expression in parens
  return `(${this.build(node.children[0])})`;
};

CodeBuilder.prototype.buildFunCall = function(node) {
  const nameCode = this.build(node.name);
  const argsCode = node.args?.children?.map(arg => this.build(arg)).join(', ') || '';
  return `${nameCode}(${argsCode})`;
};

CodeBuilder.prototype.buildBinaryOp = function(node) {
  const leftCode = this.build(node.left);
  const rightCode = this.build(node.right);
  const op = node.type;
  const opMap = {
    add: '+', sub: '-', mul: '*', div: '/', mod: '%',
    concat: ' + "" + ', floorDiv: 'Math.floor(', pow: '**'
  };
  const operator = opMap[op] || op;
  if (op === 'floorDiv') {
    return `Math.floor(${leftCode} / ${rightCode})`;
  }
  return `${leftCode} ${operator} ${rightCode}`;
};

CodeBuilder.prototype.buildLogicalOp = function(node) {
  const leftCode = this.build(node.left);
  const rightCode = this.build(node.right);
  const op = node.type === 'or' ? '||' : '&&';
  return `${leftCode} ${op} ${rightCode}`;
};

CodeBuilder.prototype.buildNullishCoalesce = function(node) {
  // For nullish coalescing, we need raw values, so use __ for symbol lookups
  let leftCode;
  if (node.left?.type === 'symbol') {
    leftCode = `__('${node.left.value}')`;
  } else {
    leftCode = this.build(node.left);
  }
  const rightCode = this.build(node.right);
  return `${leftCode} ?? ${rightCode}`;
};

CodeBuilder.prototype.buildUnaryNot = function(node) {
  const targetCode = this.build(node.target);
  return `!${targetCode}`;
};

CodeBuilder.prototype.buildUnaryOp = function(node) {
  const targetCode = this.build(node.target);
  return node.type === 'neg' ? `-${targetCode}` : `+${targetCode}`;
};

CodeBuilder.prototype.buildCompare = function(node) {
  const parts = node.ops?.map((op, i) => {
    const left = i === 0 ? this.build(node.expr) : this.build(node.conditions?.[i - 1] || op.expr);
    const right = this.build(op.expr);
    const cmp = op.operator;
    return `${left} ${cmp} ${right}`;
  }) || [];
  return parts.join(' && ');
};

CodeBuilder.prototype.buildIn = function(node) {
  const leftCode = this.build(node.left);
  const rightCode = this.build(node.right);
  return `rt.inOperator(${leftCode}, ${rightCode})`;
};

CodeBuilder.prototype.buildSlice = function(node) {
  const arrCode = this.build(node.start);
  const startCode = node.stop ? this.build(node.start) : 'null';
  const stopCode = node.stop ? this.build(node.stop) : 'null';
  const stepCode = node.step ? this.build(node.step) : 'null';
  return `rt.slice(${arrCode}, ${startCode}, ${stopCode}, ${stepCode})`;
};

CodeBuilder.prototype.buildInlineIf = function(node) {
  const condCode = this.build(node.cond);
  const bodyCode = this.build(node.body);
  const elseCode = this.build(node.else_);
  return `(${condCode} ? ${bodyCode} : ${elseCode})`;
};

CodeBuilder.prototype.buildFor = function(node) {
  const itemVar = node.name?.value;
  const arrNode = node.arr;
  const arrCode = this.build(arrNode);

  this.pushFrame();
  this.setVar(itemVar, itemVar);

  this.emitLine(``);
  this.emitLine(`  out.push((Array.isArray(${arrCode}) ? ${arrCode} : Object.values(${arrCode} ?? {})).map(${itemVar} => {`);
  this.emitLine(`    const _out = [];`);
  
  if (node.body?.children) {
    node.body.children.forEach(child => this.build(child));
  }

  this.emitLine(`    return _out.join('');`);
  this.emitLine(`  }).join(''));`);

  if (node.else_?.children) {
    this.emitLine(``);
    this.emitLine(`  if (!${arrCode} || ${arrCode}.length === 0) {`);
    node.else_.children.forEach(child => this.build(child));
    this.emitLine(`  }`);
  }

  this.popFrame();
};

CodeBuilder.prototype.buildIf = function(node) {
  const condCode = this.build(node.cond);

  this.emitLine(`  if (${condCode}) {`);
  
  if (node.body?.children) {
    node.body.children.forEach(child => this.build(child));
  }

  if (node.else_) {
    if (node.else_.type === 'if') {
      this.emitLine(`  } else {`);
      this.buildIf(node.else_);
    } else if (node.else_?.children) {
      this.emitLine(`  } else {`);
      node.else_.children.forEach(child => this.build(child));
    }
  }

  this.emitLine(`  }`);
};

CodeBuilder.prototype.buildSet = function(node) {
  const target = node.target?.value;
  const valueCode = node.value ? this.build(node.value) : '""';

  this.setVar(target, target);
  this.emitLine(`  frame.set("${target}", ${valueCode});`);
};

CodeBuilder.prototype.buildBlock = function(node) {
  this.hasBlocks = true;
  const blockName = node.name?.value;
  
  this.emitLine(`  const b_${blockName} = async function(env, context, frame, runtime) {`);
  this.emitLine(`    const output = [];`);
  
  if (node.body?.children) {
    node.body.children.forEach(child => this.build(child));
  }
  
  this.emitLine(`    return output.join("");`);
  this.emitLine(`  };`);
};

CodeBuilder.prototype.buildExtends = function(node) {
  // Extends handled at runtime level - not supported in simple render
};

CodeBuilder.prototype.buildInclude = function(node) {
  // Include handled at runtime level - not supported in simple render
};

CodeBuilder.prototype.buildImport = function(node) {
  // Import handled at runtime level - not supported in simple render
};

CodeBuilder.prototype.buildMacro = function(node) {
  // Macros handled at runtime level - not supported in simple render
};

CodeBuilder.prototype.buildCall = function(node) {
  // Call handled at runtime level - not supported in simple render
};

CodeBuilder.prototype.buildFilterStatement = function(node) {
  // Filter statements handled in expressions
};
