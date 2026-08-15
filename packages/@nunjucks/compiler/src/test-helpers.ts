import type { Compiler } from './create-compiler.ts';

export const asCompiler = (compiler: unknown): Compiler => compiler as Compiler;
