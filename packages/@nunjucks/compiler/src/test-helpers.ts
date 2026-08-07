import type { Compiler } from './create-compiler.ts';

export const asCompiler = <T>(mock: T): Compiler => mock as Compiler;