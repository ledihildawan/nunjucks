import * as nodeTypes from './nodes.js';
import {
  Node,
  NodeList,
  Block,
  FunCall,
  Pipe,
  PipeAsync,
  CallExtension,
  CallExtensionAsync,
  Symbol as ASTSymbol,
  Super,
  Output,
  Set as ASTSet,
  For,
  If,
  IfAsync,
  AsyncEach,
  AsyncAll,
  In as OperatorIn,
  Is,
  And,
  Or,
  Not,
  Add,
  Concat,
  Sub,
  Mul,
  Div,
  FloorDiv,
  Mod,
  Pow,
  Neg,
  Pos,
  OptionalChain,
  NullishCoalesce,
} from './nodes.js';

let sym = 0;
function gensym() {
  return 'hole_' + sym++;
}

function mapCOW(arr, func) {
  var res = null;
  for (let i = 0; i < arr.length; i++) {
    const item = func(arr[i]);

    if (item !== arr[i]) {
      if (!res) {
        res = arr.slice();
      }

      res[i] = item;
    }
  }

  return res || arr;
}

function walk(ast, func, depthFirst) {
  if (!(ast instanceof Node)) {
    return ast;
  }

  if (!depthFirst) {
    const astT = func(ast);

    if (astT && astT !== ast) {
      return astT;
    }
  }

  if (ast instanceof NodeList) {
    const children = mapCOW(ast.children, (node) => walk(node, func, depthFirst));

    if (children !== ast.children) {
      ast = new nodeTypes[ast.typename](ast.lineno, ast.colno, children);
    }
  } else if (ast instanceof CallExtension) {
    const args = walk(ast.args, func, depthFirst);
    const contentArgs = mapCOW(ast.contentArgs, (node) => walk(node, func, depthFirst));

    if (args !== ast.args || contentArgs !== ast.contentArgs) {
      ast = new nodeTypes[ast.typename](ast.extName, ast.prop, args, contentArgs);
    }
  } else {
    const props = ast.fields.map((field) => ast[field]);
    const propsT = mapCOW(props, (prop) => walk(prop, func, depthFirst));

    if (propsT !== props) {
      ast = new nodeTypes[ast.typename](ast.lineno, ast.colno);
      propsT.forEach((prop, i) => {
        ast[ast.fields[i]] = prop;
      });
    }
  }

  return depthFirst ? (func(ast) || ast) : ast;
}

function depthWalk(ast, func) {
  return walk(ast, func, true);
}

function _liftPipes(node, asyncPipes, prop) {
  var children = [];

  var walked = depthWalk(prop ? node[prop] : node, (descNode) => {
    let symbol;
    if (descNode instanceof Block) {
      return descNode;
    } else if ((descNode instanceof Pipe &&
      asyncPipes.indexOf(descNode.name.value) !== -1) ||
      descNode instanceof CallExtensionAsync) {
      symbol = new ASTSymbol(descNode.lineno,
        descNode.colno,
        gensym());

      children.push(new PipeAsync(descNode.lineno,
        descNode.colno,
        descNode.name,
        descNode.args,
        symbol));
    }
    return symbol;
  });

  if (prop) {
    node[prop] = walked;
  } else {
    node = walked;
  }

  if (children.length) {
    children.push(node);

    return new NodeList(
      node.lineno,
      node.colno,
      children
    );
  } else {
    return node;
  }
}

function liftPipes(ast, asyncPipes) {
  return depthWalk(ast, (node) => {
    if (node instanceof Output) {
      return _liftPipes(node, asyncPipes);
    } else if (node instanceof ASTSet) {
      return _liftPipes(node, asyncPipes, 'value');
    } else if (node instanceof For) {
      return _liftPipes(node, asyncPipes, 'arr');
    } else if (node instanceof If) {
      return _liftPipes(node, asyncPipes, 'cond');
    } else if (node instanceof CallExtension) {
      return _liftPipes(node, asyncPipes, 'args');
    } else {
      return undefined;
    }
  });
}

function liftSuper(ast) {
  return walk(ast, (blockNode) => {
    if (!(blockNode instanceof Block)) {
      return;
    }

    let hasSuper = false;
    const symbol = gensym();

    blockNode.body = walk(blockNode.body, (node) => {
      if (node instanceof FunCall && node.name.value === 'super') {
        hasSuper = true;
        return new ASTSymbol(node.lineno, node.colno, symbol);
      }
      return node;
    });

    if (hasSuper) {
      blockNode.body.children.unshift(new Super(
        0, 0, blockNode.name, new ASTSymbol(0, 0, symbol)
      ));
    }
  });
}

function convertStatements(ast) {
  return depthWalk(ast, (node) => {
    if (!(node instanceof If) && !(node instanceof For)) {
      return undefined;
    }

    let async = false;
    walk(node, (child) => {
      if (child instanceof PipeAsync ||
        child instanceof IfAsync ||
        child instanceof AsyncEach ||
        child instanceof AsyncAll ||
        child instanceof CallExtensionAsync) {
        async = true;
        return child;
      }
      return undefined;
    });

    if (async) {
      if (node instanceof If) {
        return new IfAsync(
          node.lineno,
          node.colno,
          node.cond,
          node.body,
          node.else_
        );
      } else if (node instanceof For && !(node instanceof AsyncAll)) {
        return new AsyncEach(
          node.lineno,
          node.colno,
          node.arr,
          node.name,
          node.body,
          node.else_
        );
      }
    }
    return undefined;
  });
}

function cps(ast, asyncPipes) {
  return convertStatements(liftSuper(liftPipes(ast, asyncPipes)));
}

export function transform(ast, asyncPipes) {
  sym = 0;  // Reset gensym counter per transformation
  return cps(ast, asyncPipes || []);
}
