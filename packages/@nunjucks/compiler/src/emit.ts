// EMIT - String building utilities
// Import directly: import { emit, emitLine } from '@nunjucks/compiler/emit'

export class Emitter {
  private buf: string[] = [];
  private line = 0;

  emit(code: string): void {
    this.buf.push(code);
  }

  emitLine(code: string): void {
    this.line++;
    this.buf.push(code + '\n');
  }

  code(): string {
    return this.buf.join('');
  }

  getLine(): number {
    return this.line;
  }
}

export const createEmitter = (): Emitter => new Emitter();

export const emit = (emitter: Emitter, code: string): void => emitter.emit(code);
export const emitLine = (emitter: Emitter, code: string): void => emitter.emitLine(code);
export const getCode = (emitter: Emitter): string => emitter.code();
