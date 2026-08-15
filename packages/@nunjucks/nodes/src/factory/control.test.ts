import { describe, expect, test } from 'bun:test';
import { type Loc, loc, ZERO_LOC } from '@nunjucks/shared';
import type { SlotBlock } from '../types/index.ts';
import { T } from '../types/index.ts';
import { array, literal, nodeList, output, pair, symbol } from './atomic.ts';
import {
  block,
  callExtension,
  callExtensionAsync,
  capture,
  caseNode,
  component,
  execNode,
  extendsNode,
  forNode,
  fromImportNode,
  ifNode,
  importNode,
  include,
  inlineIf,
  match,
  renderNode,
  scopeNode,
  superNode,
  switchNode,
  when,
} from './control.ts';

const customLoc: Loc = loc({ lineno: 5, colno: 8 });
const conditionNode = literal(ZERO_LOC, true);
const bodyNode = output(ZERO_LOC, []);
const iterableNode = array(ZERO_LOC, []);
const loopNameNode = symbol(ZERO_LOC, 'item');
const defaultBranchNode = output(ZERO_LOC, []);

describe('block', () => {
  test('creates a block node with name and body forwarding location', () => {
    const blockNode = block(customLoc, { name: 'content', body: bodyNode });
    expect(blockNode.type).toBe(T.BLOCK);
    expect(blockNode.lineno).toBe(customLoc.lineno);
    expect(blockNode.colno).toBe(customLoc.colno);
    expect(blockNode.name).toBe('content');
    expect(blockNode.body).toBe(bodyNode);
  });

  test('omits name and body when not provided', () => {
    const blockNode = block(ZERO_LOC);
    expect(blockNode.name).toBeUndefined();
    expect(blockNode.body).toBeUndefined();
  });
});

describe('ifNode', () => {
  test('creates an if node forwarding location, cond, and body, defaulting alternate to null', () => {
    const ifStatement = ifNode(customLoc, { cond: conditionNode, body: bodyNode });
    expect(ifStatement.type).toBe(T.IF);
    expect(ifStatement.lineno).toBe(customLoc.lineno);
    expect(ifStatement.colno).toBe(customLoc.colno);
    expect(ifStatement.cond).toBe(conditionNode);
    expect(ifStatement.body).toBe(bodyNode);
    expect(ifStatement.alternate).toBeNull();
  });

  test('stores an explicit alternate branch', () => {
    const alternateNode = output(ZERO_LOC, []);
    const ifStatement = ifNode(ZERO_LOC, {
      cond: conditionNode,
      body: bodyNode,
      alternate: alternateNode,
    });
    expect(ifStatement.alternate).toBe(alternateNode);
  });
});

describe('inlineIf', () => {
  test('creates an inlineIf node forwarding location and defaulting alternate to null', () => {
    const inlineIfStatement = inlineIf(customLoc, { cond: conditionNode, body: bodyNode });
    expect(inlineIfStatement.type).toBe(T.INLINE_IF);
    expect(inlineIfStatement.lineno).toBe(customLoc.lineno);
    expect(inlineIfStatement.colno).toBe(customLoc.colno);
    expect(inlineIfStatement.cond).toBe(conditionNode);
    expect(inlineIfStatement.body).toBe(bodyNode);
    expect(inlineIfStatement.alternate).toBeNull();
  });
});

describe('forNode', () => {
  test('creates a for node forwarding location and loop fields, defaulting alternate to null', () => {
    const forStatement = forNode(customLoc, {
      arr: iterableNode,
      name: loopNameNode,
      body: bodyNode,
    });
    expect(forStatement.type).toBe(T.FOR);
    expect(forStatement.lineno).toBe(customLoc.lineno);
    expect(forStatement.colno).toBe(customLoc.colno);
    expect(forStatement.arr).toBe(iterableNode);
    expect(forStatement.name).toBe(loopNameNode);
    expect(forStatement.body).toBe(bodyNode);
    expect(forStatement.alternate).toBeNull();
  });

  test('stores an explicit alternate branch', () => {
    const alternateNode = output(ZERO_LOC, []);
    const forStatement = forNode(ZERO_LOC, {
      arr: iterableNode,
      name: loopNameNode,
      body: bodyNode,
      alternate: alternateNode,
    });
    expect(forStatement.alternate).toBe(alternateNode);
  });
});

describe('component', () => {
  test('creates a component node forwarding name and defaulting args and fallbackSlots', () => {
    const componentNode = component(customLoc, { name: 'Card' });
    expect(componentNode.type).toBe(T.COMPONENT);
    expect(componentNode.lineno).toBe(customLoc.lineno);
    expect(componentNode.colno).toBe(customLoc.colno);
    expect(componentNode.name).toBe('Card');
    expect(componentNode.args).toEqual([]);
    expect(componentNode.fallbackSlots).toEqual([]);
  });

  test('attaches provided args, body, and fallbackSlots', () => {
    const argNode = literal(ZERO_LOC, 'title');
    const fallbackSlot: SlotBlock = { name: 'header', params: [], body: bodyNode };
    const componentNode = component(ZERO_LOC, {
      name: 'Card',
      args: [argNode],
      body: bodyNode,
      fallbackSlots: [fallbackSlot],
    });
    expect(componentNode.args).toEqual([argNode]);
    expect(componentNode.body).toBe(bodyNode);
    expect(componentNode.fallbackSlots).toEqual([fallbackSlot]);
  });
});

describe('importNode', () => {
  test('creates an import node forwarding location, defaulting withContext to false', () => {
    const importStatement = importNode(customLoc, { template: 'base.njk', target: 'base' });
    expect(importStatement.type).toBe(T.IMPORT);
    expect(importStatement.lineno).toBe(customLoc.lineno);
    expect(importStatement.colno).toBe(customLoc.colno);
    const templateValue: unknown = importStatement.template;
    expect(templateValue).toBe('base.njk');
    expect(importStatement.target).toBe('base');
    expect(importStatement.withContext).toBe(false);
  });

  test('forwards withContext when explicitly true', () => {
    const importStatement = importNode(ZERO_LOC, {
      template: 'base.njk',
      target: 'base',
      withContext: true,
    });
    expect(importStatement.withContext).toBe(true);
  });

  test('accepts a Node template', () => {
    const importStatement = importNode(ZERO_LOC, { template: loopNameNode, target: 'base' });
    expect(importStatement.template).toBe(loopNameNode);
  });
});

describe('fromImportNode', () => {
  test('creates a fromImport node forwarding location, defaulting names and withContext', () => {
    const fromImportStatement = fromImportNode(customLoc, { template: 'lib.njk' });
    expect(fromImportStatement.type).toBe(T.FROM_IMPORT);
    expect(fromImportStatement.lineno).toBe(customLoc.lineno);
    expect(fromImportStatement.colno).toBe(customLoc.colno);
    const templateValue: unknown = fromImportStatement.template;
    expect(templateValue).toBe('lib.njk');
    expect(fromImportStatement.withContext).toBe(false);
    expect(fromImportStatement.names.type).toBe(T.NODE_LIST);
    expect(fromImportStatement.names.children).toEqual([]);
  });

  test('uses the provided names node', () => {
    const namesNode = nodeList(ZERO_LOC, [symbol(ZERO_LOC, 'greet')]);
    const fromImportStatement = fromImportNode(ZERO_LOC, { template: 'lib.njk', names: namesNode });
    expect(fromImportStatement.names).toBe(namesNode);
  });
});

describe('capture', () => {
  test('creates a capture node forwarding location and body, defaulting name to null', () => {
    const captureNode = capture(customLoc, { body: bodyNode });
    expect(captureNode.type).toBe(T.CAPTURE);
    expect(captureNode.lineno).toBe(customLoc.lineno);
    expect(captureNode.colno).toBe(customLoc.colno);
    expect(captureNode.body).toBe(bodyNode);
    expect(captureNode.name).toBeNull();
  });

  test('stores an explicit name', () => {
    const captureNode = capture(ZERO_LOC, { body: bodyNode, name: 'captured' });
    expect(captureNode.name).toBe('captured');
  });
});

describe('execNode', () => {
  test('creates an exec node forwarding location and expr', () => {
    const execStatement = execNode(customLoc, conditionNode);
    expect(execStatement.type).toBe(T.EXEC);
    expect(execStatement.lineno).toBe(customLoc.lineno);
    expect(execStatement.colno).toBe(customLoc.colno);
    expect(execStatement.expr).toBe(conditionNode);
  });
});

describe('scopeNode', () => {
  test('creates a scope node forwarding location, defaulting assignments and body', () => {
    const scopeStatement = scopeNode(customLoc);
    expect(scopeStatement.type).toBe(T.SCOPE);
    expect(scopeStatement.lineno).toBe(customLoc.lineno);
    expect(scopeStatement.colno).toBe(customLoc.colno);
    expect(scopeStatement.assignments).toEqual([]);
    expect(scopeStatement.body).toBeNull();
  });

  test('attaches assignments and body', () => {
    const assignment = pair(ZERO_LOC, { key: 'counter', val: conditionNode });
    const scopeStatement = scopeNode(ZERO_LOC, { assignments: [assignment], body: bodyNode });
    expect(scopeStatement.assignments).toEqual([assignment]);
    expect(scopeStatement.body).toBe(bodyNode);
  });
});

describe('switchNode', () => {
  test('creates a switch node forwarding location, defaulting cases and default', () => {
    const switchStatement = switchNode(customLoc, { expr: conditionNode });
    expect(switchStatement.type).toBe(T.SWITCH);
    expect(switchStatement.lineno).toBe(customLoc.lineno);
    expect(switchStatement.colno).toBe(customLoc.colno);
    expect(switchStatement.expr).toBe(conditionNode);
    expect(switchStatement.cases).toEqual([]);
    expect(switchStatement.default).toBeNull();
  });

  test('attaches cases and maps default_ to default', () => {
    const switchCaseNode = caseNode(ZERO_LOC, { cond: conditionNode, body: bodyNode });
    const switchStatement = switchNode(ZERO_LOC, {
      expr: conditionNode,
      cases: [switchCaseNode],
      default_: defaultBranchNode,
    });
    expect(switchStatement.cases).toEqual([switchCaseNode]);
    expect(switchStatement.default).toBe(defaultBranchNode);
  });
});

describe('caseNode', () => {
  test('creates a case node forwarding location, cond, and body', () => {
    const caseStatement = caseNode(customLoc, { cond: conditionNode, body: bodyNode });
    expect(caseStatement.type).toBe(T.CASE);
    expect(caseStatement.lineno).toBe(customLoc.lineno);
    expect(caseStatement.colno).toBe(customLoc.colno);
    expect(caseStatement.cond).toBe(conditionNode);
    expect(caseStatement.body).toBe(bodyNode);
  });
});

describe('extendsNode', () => {
  test('creates an extends node forwarding location and template', () => {
    const extendsStatement = extendsNode(customLoc, { template: conditionNode });
    expect(extendsStatement.type).toBe(T.EXTENDS);
    expect(extendsStatement.lineno).toBe(customLoc.lineno);
    expect(extendsStatement.colno).toBe(customLoc.colno);
    expect(extendsStatement.template).toBe(conditionNode);
  });
});

describe('include', () => {
  test('creates an include node forwarding location, defaulting ignoreMissing to null', () => {
    const includeStatement = include(customLoc);
    expect(includeStatement.type).toBe(T.INCLUDE);
    expect(includeStatement.lineno).toBe(customLoc.lineno);
    expect(includeStatement.colno).toBe(customLoc.colno);
    expect(includeStatement.ignoreMissing).toBeNull();
  });

  test('forwards template and ignoreMissing', () => {
    const includeStatement = include(ZERO_LOC, { template: conditionNode, ignoreMissing: true });
    expect(includeStatement.template).toBe(conditionNode);
    expect(includeStatement.ignoreMissing).toBe(true);
  });
});

describe('superNode', () => {
  test('creates a super node forwarding location and blockName, defaulting symbol to null', () => {
    const superStatement = superNode(customLoc, { blockName: 'content' });
    expect(superStatement.type).toBe(T.SUPER);
    expect(superStatement.lineno).toBe(customLoc.lineno);
    expect(superStatement.colno).toBe(customLoc.colno);
    expect(superStatement.blockName).toBe('content');
    expect(superStatement.symbol).toBeNull();
  });

  test('maps sym to the symbol field', () => {
    const superStatement = superNode(ZERO_LOC, { blockName: 'content', sym: loopNameNode });
    expect(superStatement.symbol).toBe(loopNameNode);
  });
});

describe('match', () => {
  test('creates a match node forwarding location, defaulting cases and default', () => {
    const matchStatement = match(customLoc, { expr: conditionNode });
    expect(matchStatement.type).toBe(T.MATCH);
    expect(matchStatement.lineno).toBe(customLoc.lineno);
    expect(matchStatement.colno).toBe(customLoc.colno);
    expect(matchStatement.expr).toBe(conditionNode);
    expect(matchStatement.cases).toEqual([]);
    expect(matchStatement.default).toBeNull();
  });

  test('attaches cases and default', () => {
    const matchWhenNode = when(ZERO_LOC, { pattern: loopNameNode, body: bodyNode });
    const matchStatement = match(ZERO_LOC, {
      expr: conditionNode,
      cases: [matchWhenNode],
      default: defaultBranchNode,
    });
    expect(matchStatement.cases).toEqual([matchWhenNode]);
    expect(matchStatement.default).toBe(defaultBranchNode);
  });
});

describe('when', () => {
  test('creates a when node forwarding location, pattern, and body, defaulting guard to null', () => {
    const whenStatement = when(customLoc, { pattern: loopNameNode, body: bodyNode });
    expect(whenStatement.type).toBe(T.WHEN);
    expect(whenStatement.lineno).toBe(customLoc.lineno);
    expect(whenStatement.colno).toBe(customLoc.colno);
    expect(whenStatement.pattern).toBe(loopNameNode);
    expect(whenStatement.body).toBe(bodyNode);
    expect(whenStatement.guard).toBeNull();
  });

  test('forwards an explicit guard', () => {
    const whenStatement = when(ZERO_LOC, {
      pattern: loopNameNode,
      body: bodyNode,
      guard: conditionNode,
    });
    expect(whenStatement.guard).toBe(conditionNode);
  });
});

describe('renderNode', () => {
  test('creates a render node forwarding location, defaulting providedSlots to empty', () => {
    const renderStatement = renderNode(customLoc, { callExpr: conditionNode, body: bodyNode });
    expect(renderStatement.type).toBe(T.RENDER);
    expect(renderStatement.lineno).toBe(customLoc.lineno);
    expect(renderStatement.colno).toBe(customLoc.colno);
    expect(renderStatement.callExpr).toBe(conditionNode);
    expect(renderStatement.body).toBe(bodyNode);
    expect(renderStatement.providedSlots).toEqual([]);
  });

  test('attaches provided slots', () => {
    const slot: SlotBlock = { name: 'default', params: ['it'], body: bodyNode };
    const renderStatement = renderNode(ZERO_LOC, {
      callExpr: conditionNode,
      body: bodyNode,
      providedSlots: [slot],
    });
    expect(renderStatement.providedSlots).toEqual([slot]);
  });
});

describe('callExtension', () => {
  test('creates a callExtension node from an object ext carrying extension metadata', () => {
    const callExtNode = callExtension(customLoc, {
      ext: { extensionName: 'Ext', autoescape: false },
      prop: 'run',
    });
    expect(callExtNode.type).toBe(T.CALL_EXTENSION);
    expect(callExtNode.lineno).toBe(customLoc.lineno);
    expect(callExtNode.colno).toBe(customLoc.colno);
    expect(callExtNode.extName).toBe('Ext');
    expect(callExtNode.prop).toBe('run');
    expect(callExtNode.autoescape).toBe(false);
    expect(callExtNode.args.type).toBe(T.NODE_LIST);
    expect(callExtNode.contentArgs).toEqual([]);
  });

  test('uses a string ext as extName and defaults autoescape to true', () => {
    const callExtNode = callExtension(ZERO_LOC, { ext: 'MyTag', prop: 'foo' });
    expect(callExtNode.extName).toBe('MyTag');
    expect(callExtNode.autoescape).toBe(true);
  });

  test('returns an empty extName for a non-object, non-string ext', () => {
    const callExtNode = callExtension(ZERO_LOC, { ext: null, prop: 'foo' });
    expect(callExtNode.extName).toBe('');
  });

  test('forwards provided args and contentArgs', () => {
    const argsNode = nodeList(ZERO_LOC, [literal(ZERO_LOC, 1)]);
    const contentArgNode = output(ZERO_LOC, []);
    const callExtNode = callExtension(ZERO_LOC, {
      ext: 'Ext',
      prop: 'run',
      args: argsNode,
      contentArgs: [contentArgNode],
    });
    expect(callExtNode.args).toBe(argsNode);
    expect(callExtNode.contentArgs).toEqual([contentArgNode]);
  });
});

describe('callExtensionAsync', () => {
  test('creates a callExtensionAsync node forwarding location and ext metadata', () => {
    const asyncCallExtNode = callExtensionAsync(customLoc, { ext: 'AsyncExt', prop: 'render' });
    expect(asyncCallExtNode.type).toBe(T.CALL_EXTENSION_ASYNC);
    expect(asyncCallExtNode.lineno).toBe(customLoc.lineno);
    expect(asyncCallExtNode.colno).toBe(customLoc.colno);
    expect(asyncCallExtNode.extName).toBe('AsyncExt');
    expect(asyncCallExtNode.autoescape).toBe(true);
  });
});
