import type { Compiler } from './create-compiler.ts';

export const asCompiler = (mock: unknown): Compiler => mock as Compiler;