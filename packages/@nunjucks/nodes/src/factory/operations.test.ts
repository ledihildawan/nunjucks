import { describe, expect, test } from 'bun:test';
import { type Loc, loc, ZERO_LOC } from '@nunjucks/shared';
import type {
  AssignmentPatternNode,
  BinaryNode,
  BinaryOpNode,
  CallNode,
  ChildrenNode,
  CompareNode,
  CompareOperandNode,
  CompoundAssignNode,
  IncDecNode,
  LookupNode,
  Node,
  PairNode,
  RestPatternNode,
  SliceNode,
  TestCallNode,
  TestNode,
  UnaryNode,
  UnaryOpNode,
  VariableDeclNode,
} from '../types/index.ts';
import { T } from '../types/index.ts';
import { literal, symbol } from './atomic.ts';
import {
  add,
  and,
  arrayPattern,
  assignmentPattern,
  bitwiseAnd,
  bitwiseLShift,
  bitwiseNot,
  bitwiseOr,
  bitwiseRShift,
  bitwiseXor,
  compare,
  compareOperand,
  compoundAssignment,
  concat,
  decrement,
  div,
  floorDiv,
  funCall,
  increment,
  inNode,
  isOp,
  lookupVal,
  mod,
  mul,
  neg,
  not,
  nullishCoalesce,
  objectPattern,
  optionalCall,
  optionalChain,
  or,
  patternProperty,
  pipe,
  pos,
  pow,
  restPattern,
  slice,
  sub,
  testCallNode,
  testNode,
  variableAssignment,
  variableDeclaration,
} from './operations.ts';

const customLoc: Loc = loc({ lineno: 7, colno: 14 });
const leftOperand = literal(ZERO_LOC, 1);
const rightOperand = literal(ZERO_LOC, 2);
const targetOperand = symbol(ZERO_LOC, 'x');

describe('binary arithmetic operators', () => {
  const binaryOpCases: ReadonlyArray<{
    factory: string;
    typename: BinaryOpNode['type'];
    operator: string;
    build: (loc: Loc) => BinaryOpNode;
  }> = [
    {
      factory: 'add',
      typename: T.ADD,
      operator: '+',
      build: (position) => add(position, { left: leftOperand, right: rightOperand }),
    },
    {
      factory: 'sub',
      typename: T.SUB,
      operator: '-',
      build: (position) => sub(position, { left: leftOperand, right: rightOperand }),
    },
    {
      factory: 'mul',
      typename: T.MUL,
      operator: '*',
      build: (position) => mul(position, { left: leftOperand, right: rightOperand }),
    },
    {
      factory: 'div',
      typename: T.DIV,
      operator: '/',
      build: (position) => div(position, { left: leftOperand, right: rightOperand }),
    },
    {
      factory: 'floorDiv',
      typename: T.FLOOR_DIV,
      operator: '//',
      build: (position) => floorDiv(position, { left: leftOperand, right: rightOperand }),
    },
    {
      factory: 'mod',
      typename: T.MOD,
      operator: '%',
      build: (position) => mod(position, { left: leftOperand, right: rightOperand }),
    },
    {
      factory: 'pow',
      typename: T.POW,
      operator: '**',
      build: (position) => pow(position, { left: leftOperand, right: rightOperand }),
    },
  ];

  binaryOpCases.forEach(({ factory, typename, operator, build }) => {
    describe(factory, () => {
      test(`creates a ${typename} node forwarding location`, () => {
        const binaryNode = build(customLoc);
        expect(binaryNode.type).toBe(typename);
        expect(binaryNode.lineno).toBe(customLoc.lineno);
        expect(binaryNode.colno).toBe(customLoc.colno);
      });

      test('sets operator and attaches left/right operands', () => {
        const binaryNode = build(ZERO_LOC);
        expect(binaryNode.operator).toBe(operator);
        expect(binaryNode.left).toBe(leftOperand);
        expect(binaryNode.right).toBe(rightOperand);
      });
    });
  });
});

describe('binary nodes without operator', () => {
  const binaryNodeCases: ReadonlyArray<{
    factory: string;
    typename: BinaryNode['type'];
    build: (loc: Loc) => BinaryNode;
  }> = [
    {
      factory: 'concat',
      typename: T.CONCAT,
      build: (position) => concat(position, { left: leftOperand, right: rightOperand }),
    },
    {
      factory: 'and',
      typename: T.AND,
      build: (position) => and(position, { left: leftOperand, right: rightOperand }),
    },
    {
      factory: 'or',
      typename: T.OR,
      build: (position) => or(position, { left: leftOperand, right: rightOperand }),
    },
    {
      factory: 'nullishCoalesce',
      typename: T.NULLISH_COALESCE,
      build: (position) => nullishCoalesce(position, { left: leftOperand, right: rightOperand }),
    },
    {
      factory: 'bitwiseOr',
      typename: T.BITWISE_OR,
      build: (position) => bitwiseOr(position, { left: leftOperand, right: rightOperand }),
    },
    {
      factory: 'bitwiseAnd',
      typename: T.BITWISE_AND,
      build: (position) => bitwiseAnd(position, { left: leftOperand, right: rightOperand }),
    },
    {
      factory: 'bitwiseXor',
      typename: T.BITWISE_XOR,
      build: (position) => bitwiseXor(position, { left: leftOperand, right: rightOperand }),
    },
    {
      factory: 'bitwiseLShift',
      typename: T.BITWISE_LSHIFT,
      build: (position) => bitwiseLShift(position, { left: leftOperand, right: rightOperand }),
    },
    {
      factory: 'bitwiseRShift',
      typename: T.BITWISE_RSHIFT,
      build: (position) => bitwiseRShift(position, { left: leftOperand, right: rightOperand }),
    },
    {
      factory: 'isOp',
      typename: T.IS,
      build: (position) => isOp(position, { left: leftOperand, right: rightOperand }),
    },
    {
      factory: 'inNode',
      typename: T.IN,
      build: (position) => inNode(position, { left: leftOperand, right: rightOperand }),
    },
  ];

  binaryNodeCases.forEach(({ factory, typename, build }) => {
    describe(factory, () => {
      test(`creates a ${typename} node forwarding location`, () => {
        const binaryNode = build(customLoc);
        expect(binaryNode.type).toBe(typename);
        expect(binaryNode.lineno).toBe(customLoc.lineno);
        expect(binaryNode.colno).toBe(customLoc.colno);
      });

      test('attaches left and right operands', () => {
        const binaryNode = build(ZERO_LOC);
        expect(binaryNode.left).toBe(leftOperand);
        expect(binaryNode.right).toBe(rightOperand);
      });
    });
  });
});

describe('unary operators', () => {
  const unaryOpCases: ReadonlyArray<{
    factory: string;
    typename: UnaryOpNode['type'];
    operator: string;
    build: (loc: Loc) => UnaryOpNode;
  }> = [
    {
      factory: 'not',
      typename: T.NOT,
      operator: 'not',
      build: (position) => not(position, targetOperand),
    },
    {
      factory: 'neg',
      typename: T.NEG,
      operator: '-',
      build: (position) => neg(position, targetOperand),
    },
    {
      factory: 'pos',
      typename: T.POS,
      operator: '+',
      build: (position) => pos(position, targetOperand),
    },
  ];

  unaryOpCases.forEach(({ factory, typename, operator, build }) => {
    describe(factory, () => {
      test(`creates a ${typename} node forwarding location`, () => {
        const unaryNode = build(customLoc);
        expect(unaryNode.type).toBe(typename);
        expect(unaryNode.lineno).toBe(customLoc.lineno);
        expect(unaryNode.colno).toBe(customLoc.colno);
      });

      test('sets operator and attaches target', () => {
        const unaryNode = build(ZERO_LOC);
        expect(unaryNode.operator).toBe(operator);
        expect(unaryNode.target).toBe(targetOperand);
      });
    });
  });
});

describe('bitwiseNot', () => {
  test('creates a bitwiseNot node forwarding location and target', () => {
    const bitwiseNotNode: UnaryNode = bitwiseNot(customLoc, targetOperand);
    expect(bitwiseNotNode.type).toBe(T.BITWISE_NOT);
    expect(bitwiseNotNode.lineno).toBe(customLoc.lineno);
    expect(bitwiseNotNode.colno).toBe(customLoc.colno);
    expect(bitwiseNotNode.target).toBe(targetOperand);
  });
});

describe('slice', () => {
  test('creates a slice node forwarding start, stop, and step', () => {
    const sliceNode: SliceNode = slice(customLoc, {
      start: leftOperand,
      stop: rightOperand,
      step: null,
    });
    expect(sliceNode.type).toBe(T.SLICE);
    expect(sliceNode.lineno).toBe(customLoc.lineno);
    expect(sliceNode.colno).toBe(customLoc.colno);
    expect(sliceNode.start).toBe(leftOperand);
    expect(sliceNode.stop).toBe(rightOperand);
    expect(sliceNode.step).toBeNull();
  });

  test('supports all-null bounds', () => {
    const sliceNode = slice(ZERO_LOC, { start: null, stop: null, step: null });
    expect(sliceNode.start).toBeNull();
    expect(sliceNode.stop).toBeNull();
    expect(sliceNode.step).toBeNull();
  });
});

describe('call nodes', () => {
  const callCases: ReadonlyArray<{
    factory: string;
    typename: CallNode['type'];
    build: (loc: Loc, args?: readonly Node[]) => CallNode;
  }> = [
    {
      factory: 'funCall',
      typename: T.FUN_CALL,
      build: (position, args) =>
        funCall(
          position,
          args === undefined ? { name: targetOperand } : { name: targetOperand, args }
        ),
    },
    {
      factory: 'pipe',
      typename: T.PIPE,
      build: (position, args) =>
        pipe(
          position,
          args === undefined ? { name: targetOperand } : { name: targetOperand, args }
        ),
    },
    {
      factory: 'optionalCall',
      typename: T.OPTIONAL_CALL,
      build: (position, args) =>
        optionalCall(
          position,
          args === undefined ? { name: targetOperand } : { name: targetOperand, args }
        ),
    },
  ];

  callCases.forEach(({ factory, typename, build }) => {
    describe(factory, () => {
      test(`creates a ${typename} node forwarding location and name`, () => {
        const callNode = build(customLoc, []);
        expect(callNode.type).toBe(typename);
        expect(callNode.lineno).toBe(customLoc.lineno);
        expect(callNode.colno).toBe(customLoc.colno);
        expect(callNode.name).toBe(targetOperand);
      });

      test('attaches provided args', () => {
        const argNode = literal(ZERO_LOC, 'arg');
        const callNode = build(ZERO_LOC, [argNode]);
        expect(callNode.args).toEqual([argNode]);
      });

      test('defaults args to an empty array when omitted', () => {
        const callNode = build(ZERO_LOC);
        expect(callNode.args).toEqual([]);
      });
    });
  });
});

describe('lookup nodes', () => {
  const lookupCases: ReadonlyArray<{
    factory: string;
    typename: LookupNode['type'];
    build: (loc: Loc) => LookupNode;
  }> = [
    {
      factory: 'lookupVal',
      typename: T.LOOKUP_VAL,
      build: (position) => lookupVal(position, { target: targetOperand, val: rightOperand }),
    },
    {
      factory: 'optionalChain',
      typename: T.OPTIONAL_CHAIN,
      build: (position) => optionalChain(position, { target: targetOperand, val: rightOperand }),
    },
  ];

  lookupCases.forEach(({ factory, typename, build }) => {
    describe(factory, () => {
      test(`creates a ${typename} node forwarding location`, () => {
        const lookupNode = build(customLoc);
        expect(lookupNode.type).toBe(typename);
        expect(lookupNode.lineno).toBe(customLoc.lineno);
        expect(lookupNode.colno).toBe(customLoc.colno);
      });

      test('attaches target and val', () => {
        const lookupNode = build(ZERO_LOC);
        expect(lookupNode.target).toBe(targetOperand);
        expect(lookupNode.val).toBe(rightOperand);
      });
    });
  });
});

describe('compare', () => {
  test('creates a compare node forwarding location and expr', () => {
    const compareNode: CompareNode = compare(customLoc, { expr: targetOperand });
    expect(compareNode.type).toBe(T.COMPARE);
    expect(compareNode.lineno).toBe(customLoc.lineno);
    expect(compareNode.colno).toBe(customLoc.colno);
    expect(compareNode.expr).toBe(targetOperand);
  });

  test('defaults ops to an empty array when omitted', () => {
    const compareNode = compare(ZERO_LOC, { expr: targetOperand });
    expect(compareNode.ops).toEqual([]);
  });

  test('attaches provided ops', () => {
    const operandNode = compareOperand(ZERO_LOC, { expr: rightOperand, operator: '<' });
    const compareNode = compare(ZERO_LOC, { expr: targetOperand, ops: [operandNode] });
    expect(compareNode.ops).toEqual([operandNode]);
  });
});

describe('compareOperand', () => {
  test('creates a compareOperand node forwarding expr and operator', () => {
    const compareOperandNode: CompareOperandNode = compareOperand(customLoc, {
      expr: targetOperand,
      operator: '>=',
    });
    expect(compareOperandNode.type).toBe(T.COMPARE_OPERAND);
    expect(compareOperandNode.lineno).toBe(customLoc.lineno);
    expect(compareOperandNode.colno).toBe(customLoc.colno);
    expect(compareOperandNode.expr).toBe(targetOperand);
    expect(compareOperandNode.operator).toBe('>=');
  });
});

describe('increment and decrement', () => {
  const incDecCases: ReadonlyArray<{
    factory: string;
    typename: IncDecNode['type'];
    build: (loc: Loc, fields: { target: Node; isPostfix: boolean }) => IncDecNode;
  }> = [
    {
      factory: 'increment',
      typename: T.INCREMENT,
      build: (position, fields) => increment(position, fields),
    },
    {
      factory: 'decrement',
      typename: T.DECREMENT,
      build: (position, fields) => decrement(position, fields),
    },
  ];

  incDecCases.forEach(({ factory, typename, build }) => {
    describe(factory, () => {
      test(`creates a ${typename} node forwarding location`, () => {
        const incDecNode = build(customLoc, { target: targetOperand, isPostfix: false });
        expect(incDecNode.type).toBe(typename);
        expect(incDecNode.lineno).toBe(customLoc.lineno);
        expect(incDecNode.colno).toBe(customLoc.colno);
      });

      test('attaches target and the postfix flag', () => {
        const postfixNode = build(ZERO_LOC, { target: targetOperand, isPostfix: true });
        const prefixNode = build(ZERO_LOC, { target: targetOperand, isPostfix: false });
        expect(postfixNode.isPostfix).toBe(true);
        expect(prefixNode.isPostfix).toBe(false);
        expect(postfixNode.target).toBe(targetOperand);
      });
    });
  });
});

describe('arrayPattern and objectPattern', () => {
  const patternCases: ReadonlyArray<{
    factory: string;
    typename: ChildrenNode['type'];
    build: (loc: Loc, children?: readonly Node[]) => ChildrenNode;
  }> = [
    {
      factory: 'arrayPattern',
      typename: T.ARRAY_PATTERN,
      build: (position, children) => arrayPattern(position, children),
    },
    {
      factory: 'objectPattern',
      typename: T.OBJECT_PATTERN,
      build: (position, children) => objectPattern(position, children),
    },
  ];

  patternCases.forEach(({ factory, typename, build }) => {
    describe(factory, () => {
      test(`creates a ${typename} node forwarding location`, () => {
        const patternNode = build(customLoc, []);
        expect(patternNode.type).toBe(typename);
        expect(patternNode.lineno).toBe(customLoc.lineno);
        expect(patternNode.colno).toBe(customLoc.colno);
      });

      test('attaches the provided children', () => {
        const patternNode = build(ZERO_LOC, [targetOperand]);
        expect(patternNode.children).toEqual([targetOperand]);
      });

      test('defaults to an empty children array when omitted', () => {
        const patternNode = build(customLoc);
        expect(patternNode.children).toEqual([]);
      });
    });
  });
});

describe('patternProperty', () => {
  test('creates a patternProperty node storing key and value (val maps to value)', () => {
    const patternPropertyNode: PairNode = patternProperty(customLoc, {
      key: 'alias',
      val: targetOperand,
    });
    expect(patternPropertyNode.type).toBe(T.PATTERN_PROPERTY);
    expect(patternPropertyNode.lineno).toBe(customLoc.lineno);
    expect(patternPropertyNode.colno).toBe(customLoc.colno);
    expect(patternPropertyNode.key).toBe('alias');
    expect(patternPropertyNode.value).toBe(targetOperand);
  });

  test('accepts a Node key', () => {
    const patternPropertyNode = patternProperty(ZERO_LOC, {
      key: targetOperand,
      val: rightOperand,
    });
    expect(patternPropertyNode.key).toBe(targetOperand);
    expect(patternPropertyNode.value).toBe(rightOperand);
  });
});

describe('restPattern', () => {
  test('creates a restPattern node forwarding the target', () => {
    const restPatternNode: RestPatternNode = restPattern(customLoc, targetOperand);
    expect(restPatternNode.type).toBe(T.REST_PATTERN);
    expect(restPatternNode.lineno).toBe(customLoc.lineno);
    expect(restPatternNode.colno).toBe(customLoc.colno);
    expect(restPatternNode.target).toBe(targetOperand);
  });
});

describe('assignmentPattern', () => {
  test('creates an assignmentPattern node storing target and default value (defaultVal maps to value)', () => {
    const assignmentPatternNode: AssignmentPatternNode = assignmentPattern(customLoc, {
      target: targetOperand,
      defaultVal: rightOperand,
    });
    expect(assignmentPatternNode.type).toBe(T.ASSIGNMENT_PATTERN);
    expect(assignmentPatternNode.lineno).toBe(customLoc.lineno);
    expect(assignmentPatternNode.colno).toBe(customLoc.colno);
    expect(assignmentPatternNode.target).toBe(targetOperand);
    expect(assignmentPatternNode.value).toBe(rightOperand);
  });
});

describe('testNode', () => {
  test('creates a test node forwarding target and name', () => {
    const testNodeInstance: TestNode = testNode(customLoc, { target: targetOperand, name: 'odd' });
    expect(testNodeInstance.type).toBe(T.TEST);
    expect(testNodeInstance.lineno).toBe(customLoc.lineno);
    expect(testNodeInstance.colno).toBe(customLoc.colno);
    expect(testNodeInstance.target).toBe(targetOperand);
    expect(testNodeInstance.name).toBe('odd');
  });
});

describe('testCallNode', () => {
  test('creates a testCall node forwarding location, target, and name', () => {
    const testCallNodeInstance: TestCallNode = testCallNode(customLoc, {
      target: targetOperand,
      name: 'divisibleby',
    });
    expect(testCallNodeInstance.type).toBe(T.TEST_CALL);
    expect(testCallNodeInstance.lineno).toBe(customLoc.lineno);
    expect(testCallNodeInstance.colno).toBe(customLoc.colno);
    expect(testCallNodeInstance.target).toBe(targetOperand);
    expect(testCallNodeInstance.name).toBe('divisibleby');
  });

  test('defaults args to an empty array when omitted', () => {
    const testCallNodeInstance = testCallNode(ZERO_LOC, { target: targetOperand, name: 'even' });
    expect(testCallNodeInstance.args).toEqual([]);
  });

  test('attaches provided args', () => {
    const argNode = literal(ZERO_LOC, 3);
    const testCallNodeInstance = testCallNode(ZERO_LOC, {
      target: targetOperand,
      name: 'divisibleby',
      args: [argNode],
    });
    expect(testCallNodeInstance.args).toEqual([argNode]);
  });
});

describe('variableDeclaration and variableAssignment', () => {
  const declCases: ReadonlyArray<{
    factory: string;
    typename: VariableDeclNode['type'];
    build: (loc: Loc, fields: { targets: readonly Node[]; val: Node }) => VariableDeclNode;
  }> = [
    {
      factory: 'variableDeclaration',
      typename: T.VARIABLE_DECLARATION,
      build: (position, fields) => variableDeclaration(position, fields),
    },
    {
      factory: 'variableAssignment',
      typename: T.VARIABLE_ASSIGNMENT,
      build: (position, fields) => variableAssignment(position, fields),
    },
  ];

  declCases.forEach(({ factory, typename, build }) => {
    describe(factory, () => {
      test(`creates a ${typename} node forwarding location`, () => {
        const declNode = build(customLoc, { targets: [targetOperand], val: rightOperand });
        expect(declNode.type).toBe(typename);
        expect(declNode.lineno).toBe(customLoc.lineno);
        expect(declNode.colno).toBe(customLoc.colno);
      });

      test('stores targets and value (val maps to value)', () => {
        const declNode = build(ZERO_LOC, {
          targets: [targetOperand, leftOperand],
          val: rightOperand,
        });
        expect(declNode.targets).toEqual([targetOperand, leftOperand]);
        expect(declNode.value).toBe(rightOperand);
      });
    });
  });
});

describe('compoundAssignment', () => {
  test('creates a compoundAssignment node with targets, operator, and value', () => {
    const compoundNode: CompoundAssignNode = compoundAssignment(customLoc, {
      targets: [targetOperand],
      operator: '+=',
      value: rightOperand,
    });
    expect(compoundNode.type).toBe(T.COMPOUND_ASSIGNMENT);
    expect(compoundNode.lineno).toBe(customLoc.lineno);
    expect(compoundNode.colno).toBe(customLoc.colno);
    expect(compoundNode.targets).toEqual([targetOperand]);
    expect(compoundNode.operator).toBe('+=');
    expect(compoundNode.value).toBe(rightOperand);
  });
});

describe('child-array ownership', () => {
  test('copies caller arrays so later caller mutation cannot change the node', () => {
    // WHY: regression — these factories used to embed the caller's arrays by reference,
    // so mutating them post-construction mutated the node.
    const args = [literal(ZERO_LOC, 'a')];
    const funCallNode = funCall(ZERO_LOC, { name: 'f', args });
    args.push(literal(ZERO_LOC, 'b'));
    expect(funCallNode.args).toHaveLength(1);

    const pipeArgs = [literal(ZERO_LOC, 'a')];
    const pipeNode = pipe(ZERO_LOC, { name: 'upper', args: pipeArgs });
    pipeArgs.length = 0;
    expect(pipeNode.args).toHaveLength(1);

    const optionalCallArgs = [literal(ZERO_LOC, 'a')];
    const optionalCallNode = optionalCall(ZERO_LOC, { name: 'f', args: optionalCallArgs });
    optionalCallArgs.length = 0;
    expect(optionalCallNode.args).toHaveLength(1);

    const ops = [compareOperand(ZERO_LOC, { expr: leftOperand, operator: '<' })];
    const compareNode = compare(ZERO_LOC, { expr: rightOperand, ops });
    ops.length = 0;
    expect(compareNode.ops).toHaveLength(1);

    const testCallArgs = [literal(ZERO_LOC, 'a')];
    const testCallNodeResult = testCallNode(ZERO_LOC, {
      target: targetOperand,
      name: 'even',
      args: testCallArgs,
    });
    testCallArgs.length = 0;
    expect(testCallNodeResult.args).toHaveLength(1);

    const targets = [targetOperand];
    const compoundNode = compoundAssignment(ZERO_LOC, {
      targets,
      operator: '+=',
      value: rightOperand,
    });
    targets.length = 0;
    expect(compoundNode.targets).toHaveLength(1);
  });
});
