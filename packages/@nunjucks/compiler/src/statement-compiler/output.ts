import { isCompoundAssignment, isLookupVal, isOptionalCall, isOptionalChain, isPipe, isSymbol, isTemplateData, isVariableAssignment, isVariableDeclaration } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

export const compileTemplateData = (ctx: Compiler, node: Node, _frame: Frame): void => {
  ctx.emit(`${ctx.buffer} += `);
  ctx.emit(JSON.stringify(node.value));
  ctx.emit(';');
};

export const compileCapture = (ctx: Compiler, node: Node, frame: Frame): void => {
  const buffer = ctx.buffer;
  ctx.buffer = 'output';
  ctx.emitLine('(async () => {');
  ctx.emitLine('let output = "";');
  ctx.withScopedSyntax(() => {
    ctx.compile(node.body as Node, frame);
  });
  ctx.emitLine('return output;');
  ctx.emitLine('})()');
  ctx.buffer = buffer;
};

const extractVarName = (node: Node): string | null => {
  if (!node) { return null; }

  if (isSymbol(node)) {
    return node.value as string;
  }

  if (isLookupVal(node)) {
    const base = extractVarName(node.target as Node);
    if (!base) { return null; }
    const val = node.val as Node;
    const prop = (val?.value as unknown) || (val?.name as unknown) || '';
    return `${base}.${prop}`;
  }

  return null;
};

const extractLocation = (node: Node): { lineno: number | null; colno: number | null } => {
  if (!node) { return { lineno: null, colno: null }; }

  if (isLookupVal(node) && (node.val as Node)?.lineno !== null && (node.val as Node)?.colno !== null) {
    const val = node.val as Node;
    return { lineno: val.lineno, colno: val.colno };
  }

  return { lineno: node.lineno, colno: node.colno };
};

export const compileOutput = (ctx: Compiler, node: Node, frame: Frame): void => {
  const children = node.children;
  if (!children) {
    return;
  }
  children.forEach(child => {
    if (isTemplateData(child)) {
      if (child.value) {
        ctx.emit(`${ctx.buffer} += `);
        ctx.emit(JSON.stringify(child.value));
        ctx.emit(';');
      }
    } else if (isVariableDeclaration(child) || isVariableAssignment(child) || isCompoundAssignment(child)) {
      ctx.compile(child, frame);
    } else {
      const isPipeType = isPipe(child);
      const isOptionalChainType = isOptionalChain(child) || isOptionalCall(child);
      const varName = extractVarName(child);
      const errorLocation = extractLocation(child);
      const undefinedMode = ctx.undefinedMode;

      const useEnsureDefined = !isOptionalChainType || undefinedMode === 'debug';
      const effectiveMode = undefinedMode;

      const lineno = errorLocation.lineno ?? 0;
      const colno = errorLocation.colno ?? 0;
      const htmlContext = ctx.getHtmlContext(lineno, colno);
      ctx.emitLineWithLineno(
        `lineno = ${lineno}; colno = ${colno}; ${ctx.buffer} += runtime.suppressValue(`,
        lineno,
        colno
      );
      if (!isPipeType) {
        ctx.emit('await runtime.awaitValue(');
      }
      if (useEnsureDefined) {
        ctx.emit('runtime.ensureDefined(');
      }
      ctx.compile(child, frame);
      if (useEnsureDefined) {
        let nameArg: string;
        if (varName) {
          nameArg = `, "${varName}"`;
        } else {
          nameArg = ', null';
        }
        let modeArg: string;
        if (effectiveMode) {
          modeArg = `, "${effectiveMode}"`;
        } else {
          modeArg = '';
        }
        ctx.emit(`,${lineno},${colno}${nameArg}, null${modeArg})`);
      }
      if (!isPipeType) {
        ctx.emit(')');
      }
      ctx.emit(`, env.opts.autoescape, lineno, colno, "${htmlContext}");`);
    }
  });
  ctx.emit('\n');
};
