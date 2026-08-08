import { createLog, ERROR_DEFINITIONS } from '@nunjucks/log';
import { last, pipe, split } from 'remeda';
import type { Emitter } from './index.ts';

export const fail = (
  compiler: { templateName: string | null },
  msg: string,
  lineno?: number,
  colno?: number,
  errorName: string = 'WALK_UNKNOWN_TYPE'
): never => {
  const lastPart = pipe(msg, split(':'), last());
  const subject = (lastPart ?? 'compile').trim();
  const errorDef = ERROR_DEFINITIONS[errorName as keyof typeof ERROR_DEFINITIONS] ?? ERROR_DEFINITIONS.WALK_UNKNOWN_TYPE;

  throw createLog('error', {
    def: errorDef,
    params: { type: subject, detail: msg },
    subject,
    context: {
      lineno,
      colno,
      phase: 'compile',
      templateName: compiler.templateName,
      lineBase: 'zero',
    }
  });
};

export const tmpid = (compiler: { lastId: number }): string => {
  compiler.lastId += 1;
  return `t_${compiler.lastId}`;
};

export const emitLocationGuard = (
  compiler: Pick<Emitter, 'emit'>,
  lineno: number,
  colno: number
): void => {
  compiler.emit(`(lineno = ${lineno}, colno = ${colno}, `);
};

export const emitLineLocation = (
  compiler: Pick<Emitter, 'emitLine'>,
  lineno: number,
  colno: number
): void => {
  compiler.emitLine(`lineno = ${lineno}; colno = ${colno};`);
};

export const pushBuffer = (
  compiler: Pick<Emitter, 'buffer' | 'bufferStack' | 'emit' | 'getCode'> & { lastId: number }
): string => {
  const id = tmpid(compiler);
  compiler.bufferStack.push(compiler.buffer);
  compiler.buffer = id;
  compiler.emit(`let ${id} = "";`);
  return id;
};

export const getTemplateName = (
  compiler: { templateName: string | null }
): string => {
  if (compiler.templateName === null || compiler.templateName === undefined) {
    return 'undefined';
  }
  return JSON.stringify(compiler.templateName);
};
