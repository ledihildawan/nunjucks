import type { TemplateError } from '@nunjucks/error-formatter';
import type { Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import type { ParserContext } from '../cursor.ts';
import { parseBlock } from './block.ts';
import { parseCapture } from './capture.ts';
import { parseComponent } from './component.ts';
import { parseExec } from './exec.ts';
import { parseExtends } from './extends.ts';
import { parseFilterStatement } from './filter.ts';
import { parseFor } from './for.ts';
import { parseFrom } from './from.ts';
import { parseIf } from './if.ts';
import { parseImport } from './import.ts';
import { parseInclude } from './include.ts';
import { parseMatch } from './match.ts';
import { parseRenderBlock } from './render.ts';
import { parseScope } from './scope.ts';
import { parseSwitch } from './switch.ts';

type StatementParser = (parserContext: ParserContext) => Result<Node, TemplateError>;
type TaggedParser = (
  parserContext: ParserContext,
  ...args: unknown[]
) => Result<Node, TemplateError>;

/**
 * Tag-name-to-parser table for every built-in statement; `parseStatement`
 * looks tags up here before falling back to extensions.
 */
const STATEMENT_PARSERS: Record<string, StatementParser | TaggedParser> = {
  if: parseIf,
  for: parseFor,
  block: parseBlock,
  extends: parseExtends,
  include: parseInclude,
  component: parseComponent,
  import: parseImport,
  from: parseFrom,
  filter: parseFilterStatement,
  switch: parseSwitch,
  exec: parseExec,
  scope: parseScope,
  match: parseMatch,
  capture: parseCapture,
  render: parseRenderBlock,
};

export { STATEMENT_PARSERS };
