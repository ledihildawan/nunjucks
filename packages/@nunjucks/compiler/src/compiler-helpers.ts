import { createLog, ERROR_DEFINITIONS } from '@nunjucks/log';
import { last, pipe, split } from 'remeda';
import type { Compiler } from './index.ts';

export const fail = (
  ctx: Pick<Compiler, 'templateName'>,
  msg: string,
  lineno?: number,
  colno?: number,
  errorName: string = 'WALK_UNKNOWN_TYPE'
): never => {
  const lastPart = pipe(msg, split(':'), last());
  const subject = (lastPart || 'compile').trim();
  const errorDef = ERROR_DEFINITIONS[errorName as keyof typeof ERROR_DEFINITIONS] ?? ERROR_DEFINITIONS.WALK_UNKNOWN_TYPE;

  throw createLog(
    'error',
    errorDef,
    { type: subject, detail: msg },
    subject,
    {
      lineno,
      colno,
      phase: 'compile',
      templateName: ctx.templateName,
      lineBase: 'zero',
    }
  );
};

export const tmpid = (ctx: Pick<Compiler, 'lastId'>): string => {
  ctx.lastId += 1;
  return `t_${ctx.lastId}`;
};

export const emitLocationGuard = (
  ctx: Pick<Compiler, 'emit'>,
  lineno: number,
  colno: number
): void => {
  ctx.emit(`(lineno = ${lineno}, colno = ${colno}, `);
};

export const emitLineLocation = (
  ctx: Pick<Compiler, 'emitLine'>,
  lineno: number,
  colno: number
): void => {
  ctx.emitLine(`lineno = ${lineno}; colno = ${colno};`);
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
