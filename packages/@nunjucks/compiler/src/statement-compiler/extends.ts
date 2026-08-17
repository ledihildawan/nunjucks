import { ERROR_CODES } from '@nunjucks/error-catalog';
import type { ExtendsNode, IncludeNode } from '@nunjucks/nodes';
import { WARNINGS_CONTEXT_KEY as WARNINGS_KEY } from '@nunjucks/shared';
import { appendTarget, emitLineLocation } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { compileGetTemplate, getTemplateLocation } from './template-lookup.ts';

/**
 * Compiles `{% extends %}`: eagerly resolves the parent into
 * `parentTemplate`, then unions the parent's blocks into the context so the
 * delegation pass can find every override.
 */
export const compileExtends = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<ExtendsNode>
): void => {
  const blockKey = compiler.nextCompilerId();

  const parentTemplateId = compileGetTemplate({
    compiler,
    node,
    frame,
    options: { eagerCompile: true, ignoreMissing: false, includeChain: compiler.getTemplateName() },
  });

  compiler.emitLine(`parentTemplate = ${parentTemplateId}`);

  compiler.emitLine('let __parentBlockNames = Object.keys(parentTemplate.blocks);');
  compiler.emitLine('context = context.setParentBlockNames(__parentBlockNames);');

  compiler.emitLine(`for(let ${blockKey} in parentTemplate.blocks) {`);
  compiler.emitLine(`context = context.addBlock(${blockKey}, parentTemplate.blocks[${blockKey}]);`);
  compiler.emitLine('}');

  // WHY: NO eager validateBlocks here — a multi-level chain cannot know yet whether a
  // child block matches a grandparent hole (the direct parent may omit it). Validation
  // runs at getBlock time against the fully-unioned ancestry names instead; a block
  // matching no hole anywhere still errors there (getBlock → UNDEFINED_BLOCK).
};

/**
 * Compiles `{% include %}`: guards the template name, awaits
 * `env.getTemplate` (null-safe under `ignoreMissing`), renders with `only`/
 * `with` context semantics, and appends the result via `appendTarget`.
 */
export const compileInclude = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<IncludeNode>
): void => {
  const tmplVar = compiler.nextCompilerId();
  const resultVar = compiler.nextCompilerId();
  const location = getTemplateLocation(node);

  const emitIncludeBody = (): void => {
    emitLineLocation(compiler, location.lineno, location.colno);
    compiler.emit(`let ${tmplVar} = `);
    compiler.compileExpression(node.template, frame);
    compiler.emitLine(';');
    compiler.emitLine(
      `if(typeof ${tmplVar} !== 'string') { const err = new Error('template names must be a string'); err.code = ${JSON.stringify(ERROR_CODES.INVALID_INCLUDE)}; err.subject = ${tmplVar}; throw err; }`
    );
    const ignoreMissing = node.ignoreMissing ? 'true' : 'false';
    const includeChain = `{parentTmpl: ${compiler.getTemplateName()}, parentLineno: ${location.lineno + 1}, parentColno: ${location.colno + 1}}`;
    compiler.emit(
      `let ${tmplVar}_template = await env.getTemplate({ name: ${tmplVar}, eagerCompile: false, includeChain: ${includeChain}, ignoreMissing: ${ignoreMissing} });`
    );

    // WHY: env.getTemplate returns null (not a Template) for a missing source when
    // ignoreMissing is set — the render call below must be guarded or the generated
    // code dereferences null and surfaces a TypeError instead of skipping silently.
    if (node.ignoreMissing) {
      compiler.emitLine(`if (${tmplVar}_template !== null) {`);
    }
    if (node.only) {
      compiler.emit(
        `let ${resultVar} = await ${tmplVar}_template.render({}, frame, runtime[${JSON.stringify(WARNINGS_KEY)}]);`
      );
    } else if (node.with) {
      // WHY: fork(childContext) merges via object spread (define-own semantics), so an own
      // '__proto__' key in the with-expression cannot retarget the forked context's
      // prototype the way an Object.assign [[Set]] merge would.
      compiler.emit('let __withData = ');
      compiler.compileExpression(node.with, frame);
      compiler.emitLine(';');
      compiler.emit('let __forkedCtx = context.fork(__withData);');
      compiler.emit(
        `let ${resultVar} = await ${tmplVar}_template.render(__forkedCtx.getVariables(), frame, runtime[${JSON.stringify(WARNINGS_KEY)}]);`
      );
    } else {
      compiler.emit(
        `let ${resultVar} = await ${tmplVar}_template.render(context.getVariables(), frame, runtime[${JSON.stringify(WARNINGS_KEY)}]);`
      );
    }
    compiler.emitLine(`${appendTarget(compiler)}${resultVar};`);
    if (node.ignoreMissing) {
      compiler.emitLine('}');
    }
  };

  if (compiler.streamErrorRecovery) {
    compiler.emitLine('try {');
    emitIncludeBody();
    compiler.emitStreamCatch(location.lineno, location.colno);
  } else {
    emitIncludeBody();
  }
};
