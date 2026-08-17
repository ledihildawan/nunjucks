import { describe, expect, test } from 'bun:test';
import { templateData } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { ZERO_LOC } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';
import { compileTemplateData } from './compile-data.ts';
import { makeCompileDataCompiler } from './test-helpers.ts';

describe('compileTemplateData', () => {
  test('emits buffer += JSON-stringified value', () => {
    const c = makeCompileDataCompiler();
    compileTemplateData(asCompiler(c), {
      node: templateData(ZERO_LOC, 'hi'),
      frame: createFrame(),
    });
    expect(c.emitted.join('')).toBe('output += "hi";');
  });
});
