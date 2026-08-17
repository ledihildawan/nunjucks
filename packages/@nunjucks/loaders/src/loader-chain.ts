import type { TemplateError } from '@nunjucks/error-formatter';
import type { Result } from '@nunjucks/lib';

// WHY: the minimal loader contract the render pipeline consumes — getSource resolves a
// template name to source text. `null` means "not found here" (a chain moves on to the
// next loader); `err` is a hard failure (filesystem error, permission denied) that aborts
// resolution; `ok` carries the source. Note: the built-in FS loader treats a
// traversal-blocked name as a MISS (null, defers onward) — nothing is ever read for it;
// custom loaders decide their own miss-vs-error envelope. Custom loaders only need this shape.
export interface TemplateLoaderSource {
  src: string;
  path: string;
}

export interface TemplateLoader {
  getSource: (name: string) => Promise<Result<TemplateLoaderSource, TemplateError> | null>;
}

interface ResolveChainInput {
  loaders: readonly TemplateLoader[];
  name: string;
}

// WHY: recursive first-match-wins — the first loader returning a non-null result (ok OR
// err) ends resolution; null defers to the next loader. Mirrors findFileInSearchPaths.
const resolveChainSource = async ({
  loaders,
  name,
}: ResolveChainInput): Promise<Result<TemplateLoaderSource, TemplateError> | null> => {
  const [firstLoader, ...remainingLoaders] = loaders;
  if (firstLoader === undefined) {
    return null;
  }
  const result = await firstLoader.getSource(name);
  if (result !== null) {
    return result;
  }
  return resolveChainSource({ loaders: remainingLoaders, name });
};

const createLoaderChain = (loaders: readonly TemplateLoader[]): TemplateLoader => ({
  getSource: (name: string) => resolveChainSource({ loaders, name }),
});

export { createLoaderChain };
