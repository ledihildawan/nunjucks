// WHY: test-only helper — never exported via the package barrel; it lets co-located
// *.test.ts files feed recording compiler doubles through the public Compiler type.
import type { Compiler } from './create-compiler.ts';

export const asCompiler = (compiler: unknown): Compiler => compiler as Compiler;
