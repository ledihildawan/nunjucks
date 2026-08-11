import type { ParserContext } from "../cursor.ts";
import type { Node } from '@nunjucks/nodes';
import type { Result } from '@nunjucks/lib';
import type { TemplateError } from '@nunjucks/log';
import { parseFor } from "./for.ts";
import { parseComponent } from "./component.ts";
import { parseImport } from "./import.ts";
import { parseFrom } from "./from.ts";
import { parseBlock } from "./block.ts";
import { parseExtends } from "./extends.ts";
import { parseInclude } from "./include.ts";
import { parseIf } from "./if.ts";
import { parseSwitch } from "./switch.ts";
import { parseFilterStatement } from "./filter.ts";
import { parseExec } from "./exec.ts";
import { parseScope } from "./scope.ts";
import { parseMatch } from "./match.ts";
import { parseCapture } from "./capture.ts";
import { parseRenderBlock } from "./render.ts";

type StatementParser = (parserContext: ParserContext) => Result<Node, TemplateError>;
type TaggedParser = (parserContext: ParserContext, ...args: unknown[]) => Result<Node, TemplateError>;

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
