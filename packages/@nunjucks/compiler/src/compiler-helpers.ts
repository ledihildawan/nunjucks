import { createLog, ERROR_DEFINITIONS } from '@nunjucks/log';
import type { Compiler } from './index.ts';

export const fail = (
  ctx: Pick<Compiler, 'templateName'>,
  msg: string,
  lineno?: number,
  colno?: number
): never => {
  const lastPart = msg.split(':').pop();
  const subject = (lastPart || 'compile').trim();
  const errorDef = ERROR_DEFINITIONS.WALK_UNKNOWN_TYPE;

  if (errorDef) {
    throw createLog(
      'error',
      errorDef,
      { type: subject },
      subject,
      {
        lineno,
        colno,
        phase: 'compile',
        templateName: ctx.templateName,
        lineBase: 'zero',
      }
    );
  }

  throw new Error(`unknown type: ${subject}`);
};

export const tmpid = (ctx: Pick<Compiler, 'lastId'>): string => {
  ctx.lastId += 1;
  return `t_${ctx.lastId}`;
};

export const pushBuffer = (
  ctx: Pick<Compiler, 'buffer' | 'bufferStack' | 'emit' | 'lastId'>
): string => {
  const id = tmpid(ctx);
  ctx.bufferStack.push(ctx.buffer);
  ctx.buffer = id;
  ctx.emit(`let ${id} = "";`);
  return id;
};

export const getTemplateName = (
  ctx: Pick<Compiler, 'templateName'>
): string => {
  if (ctx.templateName === null || ctx.templateName === undefined) {
    return 'undefined';
  }
  return JSON.stringify(ctx.templateName);
};
