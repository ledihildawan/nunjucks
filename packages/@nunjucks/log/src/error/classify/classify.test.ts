import { describe, expect, test } from 'bun:test';
import { classifyFromError } from './classify.ts';

describe('classifyFromError', () => {
  test('humanizes circular include titles from enriched messages', () => {
    const classification = classifyFromError({
      code: 'CIRCULAR_INCLUDE',
      subject: 'C:\\Users\\me\\project\\samples\\express\\views\\errors\\circular-include-a.njk',
      message: '(C:\\Users\\me\\project\\samples\\express\\views\\errors\\circular-include-a.njk)\n (C:\\Users\\me\\project\\samples\\express\\views\\errors\\circular-include-b.njk) [Line 1, Column 13]\n  Circular include detected: C:\\Users\\me\\project\\samples\\express\\views\\errors\\circular-include-a.njk'
    });

    expect(classification.title).toBe('Circular include detected: errors/circular-include-a.njk');
    expect(classification.title).not.toContain('C:\\Users');
  });
});
