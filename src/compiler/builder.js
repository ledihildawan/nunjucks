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
    default:
      throw new Error(`Unknown node type: ${type}`);
  }
};

CodeBuilder.prototype.buildRoot = function(node) {
  this.pushFrame();
  
  const asyncKeyword = this.options.async !== false ? 'async ' : '';
  this.emitLine(`${asyncKeyword}function root(env, context, frame, runtime) {`);
  this.emitLine(`  const output = [];`);
  
  if (node.children) {
    node.children.forEach(child => this.build(child));
  }

  if (this.hasBlocks) {
    this.emitLine(`  if (parentTemplate) {`);
    this.emitLine(`    return await parentTemplate.rootRenderFunc(env, context, frame, runtime);`);
    this.emitLine(`  }`);
  }

  this.emitLine(`  return output.join("");`);
  this.emitLine(`}`);
  this.emitLine(`return { root };`);

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
    this.emitLine(`  output.push(${escaped});`);
  }
};

CodeBuilder.prototype.buildSymbol = function(node) {
  const varName = node.value;
  if (this.getVar(varName)) {
    return varName;
  }
  
  const lookup = `runtime.contextOrFrameLookup(context, frame, "${varName}")`;
  
  // Use ensureDefined if undefined mode is strict
  if (this.options.undefined === 'strict') {
    return `runtime.ensureDefined(${lookup}, 0, 0, "${varName}", "${this.name}", "strict")`;
  }
  
  // Debug mode should return the string "undefined"
  if (this.options.undefined === 'debug') {
    return `(${lookup} ?? "undefined")`;
  }
  
  return lookup;
};

CodeBuilder.prototype.buildLiteral = function(node) {
  return JSON.stringify(node.value);
};

CodeBuilder.prototype.buildExpression = function(node) {
  if (isSymbol(node)) {
    const symbolCode = this.buildSymbol(node);
    this.emitLine(`  output.push(runtime.suppressValue(${symbolCode}, env.opts.autoescape));`);
  } else if (isLiteral(node)) {
    this.emitLine(`  output.push(runtime.suppressValue(${this.buildLiteral(node)}, env.opts.autoescape));`);
  } else if (isPipe(node) || isPipeAsync(node)) {
    this.buildPipe(node);
  } else {
    this.emitLine(`  output.push(runtime.suppressValue(${this.build(node)}, env.opts.autoescape));`);
  }
};

CodeBuilder.prototype.buildPipe = function(node) {
  const filterName = node.name?.value;
  const args = node.args?.children || [];
  
  const argsCode = args.map((arg) => this.build(arg)).join(', ');

  const awaitKw = this.options.async !== false ? 'await ' : '';
  this.emitLine(`  output.push(runtime.escape(${awaitKw}env.getFilter("${filterName}").call(context, ${argsCode})));`);
};

CodeBuilder.prototype.buildPipeAsync = function(node) {
  this.hasAsync = true;
  this.buildPipe(node);
};

CodeBuilder.prototype.buildFor = function(node) {
  const itemVar = node.name?.value;
  const arrNode = node.arr;
  const arrCode = this.build(arrNode);

  this.pushFrame();
  this.setVar(itemVar, itemVar);

  this.emitLine(`  for (const ${itemVar} of runtime.fromIterator(${arrCode})) {`);
  
  if (node.body?.children) {
    node.body.children.forEach(child => this.build(child));
  }

  this.emitLine(`  }`);

  if (node.else_?.children) {
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
  const parent = node.parent?.value;
  this.emitLine(`  const parentTemplate = runtime.loadTemplate("${parent}");`);
};

CodeBuilder.prototype.buildInclude = function(node) {
  const template = node.template?.value;
  this.emitLine(`  const included = runtime.include("${template}", context, frame, runtime);`);
  this.emitLine(`  output.push(included);`);
};

CodeBuilder.prototype.buildImport = function(node) {
  const template = node.template?.value;
  const name = node.target?.value;
  this.emitLine(`  context["${name}"] = await runtime.importFile("${template}", context);`);
};

CodeBuilder.prototype.buildMacro = function(node) {
  const name = node.name?.value;
  const args = node.args?.children || [];
  
  this.emitLine(`  runtime.macros["${name}"] = async function(${args.map(a => a.value).join(', ')}) {`);
  this.emitLine(`    const output = [];`);
  
  if (node.body?.children) {
    node.body.children.forEach(child => this.build(child));
  }
  
  this.emitLine(`    return output.join("");`);
  this.emitLine(`  };`);
};

CodeBuilder.prototype.buildCall = function(node) {
  const name = node.name?.value;
  this.emitLine(`  await env.getExtension("${name}")(context, frame, runtime, output);`);
};

CodeBuilder.prototype.buildFilterStatement = function(node) {
  const name = node.name?.value;
  this.emitLine(`  output = runtime.filter("${name}", output);`);
};
