import { describe, expect, test } from 'bun:test';
import { templateData } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime/frame';
import { ZERO_LOC } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';
import { compileTemplateData } from './compile-data.ts';

const makeCompiler = () => {
  const emitted: string[] = [];
  return {
    emitted,
    buffer: 'output',
    emit: (s: string) => {
      emitted.push(s);
    },
    emitLine: (s: string) => {
      emitted.push(`${s}\n`);
    },
  };
};

describe('compileTemplateData', () => {
  test('emits buffer += JSON-stringified value', () => {
    const c = makeCompiler();
    compileTemplateData(asCompiler(c), { node: templateData(ZERO_LOC, 'hi'), frame: createFrame() });
    expect(c.emitted.join('')).toBe('output += "hi";');
  });
});
