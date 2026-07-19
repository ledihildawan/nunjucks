import { describe, test, expect } from 'bun:test';
import { ERROR_DEFINITIONS } from '@nunjucks/log';

const tokenize = (text) => {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);
};

const calcJaccardSimilarity = (a, b) => {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  const intersection = [...aTokens].filter(t => bTokens.has(t));
  const union = new Set([...aTokens, ...bTokens]);
  return intersection.length / union.size;
};

describe('suggestion quality audit (jaccard)', () => {
  const errorsWithSuggestions = Object.entries(ERROR_DEFINITIONS).filter(([_, def]) => def.suggestion);

  test('suggestions should be sufficiently different from causes/fix', () => {
    const issues = [];
    for (const [name, def] of errorsWithSuggestions) {
      const others = [
        ...(def.causes || []),
        def.fixComment || '',
        def.fixCode || ''
      ];
      let maxSimilarity = 0;
      let maxAgainst = '';
      for (const other of others) {
        const sim = calcJaccardSimilarity(def.suggestion, other);
        if (sim > maxSimilarity) {
          maxSimilarity = sim;
          maxAgainst = other.substring(0, 50);
        }
      }
      if (maxSimilarity > 0.4) {
        issues.push({
          name,
          suggestion: def.suggestion,
          similarity: Math.round(maxSimilarity * 100) + '%',
          similarTo: maxAgainst
        });
      }
    }
    if (issues.length > 0) {
      console.log('\n=== Highly similar suggestions ===');
      issues.forEach(i => console.log(`  ${i.name} (${i.similarity}): "${i.suggestion}"\n    similar to: "${i.similarTo}..."`));
    }
    expect(issues.length).toBe(0);
  });
});
