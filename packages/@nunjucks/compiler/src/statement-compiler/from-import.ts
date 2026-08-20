import { ERROR_CODES } from '@nunjucks/error-catalog';
import type { FromImportNode, Node } from '@nunjucks/nodes';
import { isPair } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import { assertSafeIdentifier } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { compileGetTemplate } from './template-lookup.ts';

const extractNameAlias = (compiler: Compiler, nameNode: Node): { name: string; alias: string } => {
  if (isPair(nameNode)) {
    const key = nameNode.key;
    const name = typeof key === 'string' ? key : String(key.value);
    // WHY: String() coercion of a malformed pair value would silently bind the
    // alias "undefined"; fail loudly with a catalogued compile error instead.
    const aliasValue = nameNode.value.value;
    if (typeof aliasValue !== 'string') {
      // WHY: String() coercion of a malformed pair value would silently bind the
      // alias "undefined"; fail loudly with a catalogued compile error instead.
      compiler.fail({
        message: 'from-import: alias must be a name',
        lineno: nameNode.lineno,
        colno: nameNode.colno,
      });
      return { name, alias: name };
    }
    return { name, alias: aliasValue };
  }
  const name = String(nameNode.value);
  return { name, alias: name };
};

interface CompileImportedNameOptions {
  compiler: Compiler;
  nameNode: Node;
  importedId: string;
  frame: Frame;
}

const compileImportedName = ({
  compiler,
  nameNode,
  importedId,
  frame,
}: CompileImportedNameOptions): void => {
  const { name, alias } = extractNameAlias(compiler, nameNode);
  assertSafeIdentifier(name, { compiler });
  assertSafeIdentifier(alias, { compiler });
  const id = compiler.nextCompilerId();

  compiler.emitLine(`let ${id};`);
  compiler.emitLine(`if(Object.hasOwn(${importedId}_exported, ${JSON.stringify(name)})) {`);
  compiler.emitLine(`${id} = ${importedId}_exported[${JSON.stringify(name)}];`);
  compiler.emitLine('} else {');
  // WHY: the attached code lets the error funnel classify this throw as IMPORT_ERROR
  // (causes/fixCode/docs) instead of degrading to the generic RUNTIME_ERROR definition.
  compiler.emitLine(
    `const importError = new Error('Cannot import ' + ${JSON.stringify(name)} + ' from module'); importError.code = '${ERROR_CODES.IMPORT_ERROR}'; importError.subject = ${JSON.stringify(name)}; throw importError;`
  );
  compiler.emitLine('}');

  if (frame.parent) {
    compiler.emitLine(`frame = frame.set({ name: ${JSON.stringify(alias)}, value: ${id} });`);
  } else {
    compiler.emitLine(`context = context.setVariable(${JSON.stringify(alias)}, ${id});`);
  }
};

/**
 * Compiles `{% from %}` imports: awaits the template's `getExported`, then
 * binds each name (or `alias`) via `compileImportedName`'s own-property guard.
 */
export const compileFromImport = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<FromImportNode>
): void => {
  const importedId = compileGetTemplate({
    compiler,
    node,
    frame,
    options: {
      eagerCompile: false,
      ignoreMissing: false,
      includeChain: compiler.getTemplateName(),
    },
  });

  const withContextArg = node.withContext ? 'context.getVariables(), frame' : '';
  compiler.emitLine(
    `let ${importedId}_exported = await ${importedId}.getExported(${withContextArg});`
  );

  forEach(node.names.children, (nameNode) =>
    compileImportedName({ compiler, nameNode, importedId, frame })
  );
};
