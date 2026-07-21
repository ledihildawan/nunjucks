// COMPILE - Main compilation function
// Import directly: import { compile } from '@nunjucks/compiler/compile'

import { type Node } from '@nunjucks/nodes/types';
import { createEmitter, type Emitter } from './emit.ts';

export const compile = (ast: Node, options?: { name?: string }): string => {
  const emitter = createEmitter();
  emitProgram(emitter, ast);
  return getCode(emitter);
};

const emitProgram = (emitter: Emitter, node: Node): void => {
  const type = node.type;
  
  switch (type) {
    case 'root':
    case 'nodeList':
    case 'output':
      const children = (node as unknown as { children?: Node[] }).children ?? [];
      for (const child of children) {
        emitProgram(emitter, child);
      }
      break;
    case 'literal':
    case 'symbol':
    case 'templateData':
      emitter.emit(JSON.stringify((node as unknown as { value: unknown }).value));
      break;
    case 'funCall':
      emitFunCall(emitter, node);
      break;
    case 'add':
    case 'sub':
    case 'mul':
    case 'div':
      emitBinaryOp(emitter, node);
      break;
    case 'if':
      emitIf(emitter, node);
      break;
    case 'for':
      emitFor(emitter, node);
      break;
    default:
      emitter.emit(`/* TODO: ${type} */`);
  }
};

const emitFunCall = (emitter: Emitter, node: Node): void => {
  const { name, args } = node as unknown as { name: string; args: Node[] };
  const argStr = ((args ?? []).map(a => JSON.stringify((a as unknown as { value: unknown }).value))).join(', ');
  emitter.emit(`${name}(${argStr})`);
};

const emitBinaryOp = (emitter: Emitter, node: Node): void => {
  const { left, right, operator } = node as unknown as { left: Node; right: Node; operator: string };
  emitter.emit('(');
  emitProgram(emitter, left);
  emitter.emit(operator);
  emitProgram(emitter, right);
  emitter.emit(')');
};

const emitIf = (emitter: Emitter, node: Node): void => {
  const { cond, body, else_ } = node as unknown as { cond: Node; body: Node; else_: Node | null };
  emitter.emit('if(');
  emitProgram(emitter, cond);
  emitter.emitLine(') {');
  emitProgram(emitter, body);
  emitter.emitLine('}');
  if (else_) {
    emitter.emit('else {');
    emitProgram(emitter, else_);
    emitter.emitLine('}');
  }
};

const emitFor = (emitter: Emitter, node: Node): void => {
  const { arr, name, body } = node as unknown as { arr: Node; name: string; body: Node };
  emitter.emit('for(const ' + name + ' of ');
  emitProgram(emitter, arr);
  emitter.emitLine(') {');
  emitProgram(emitter, body);
  emitter.emitLine('}');
};
