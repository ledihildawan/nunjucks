import { nodes } from '../../nodes/index.js';

const uniqueId = (() => {
  let n = 0;
  return (prefix) => `${prefix}_${++n}`;
})();

const safeMemberLookup = (source, key) =>
  `runtime.optionalMemberLookup(${source}, ${JSON.stringify(key)})`;

const safeArrayIndex = (source, index) =>
  `(Array.isArray(${source}) ? ${source}[${index}] : (${source} != null && typeof ${source} === 'object' ? ${source}[${index}] : undefined))`;

const arraySlice = (source, start) =>
  `(${source} != null && Array.isArray(${source}) ? ${source}.slice(${start}) : undefined)`;

const objectRest = (source, restId) =>
  `(() => { const ${restId} = {}; if (${source} != null && typeof ${source} === 'object') { for (const __k in ${source}) { ${restId}[__k] = ${source}[__k]; } } return ${restId}; })()`;

const compileAssignToFrame = (ctx, frame, name, source) => {
  ctx._emitLine(`frame.set(${JSON.stringify(name)}, ${source}, true);`);
  ctx._emitLine(`context.setVariable(${JSON.stringify(name)}, ${source});`);
  if (name.charAt(0) !== '_') {
    ctx._emitLine('if(frame.topLevel) {');
    ctx._emitLine(`context.addExport(${JSON.stringify(name)}, ${source});`);
    ctx._emitLine('}');
  }
  const existingId = frame.lookup(name);
  if (existingId !== null && existingId !== undefined) {
    ctx._emitLine(`let ${existingId} = ${source};`);
  } else {
    const id = ctx._tmpid();
    frame.set(name, id);
    ctx._emitLine(`let ${id} = ${source};`);
  }
};

const compileDestructuring = (ctx, frame, pattern, source) => {
  if (nodes.isSymbol(pattern)) {
    compileAssignToFrame(ctx, frame, pattern.value, source);
    return;
  }

  if (nodes.isArrayPattern(pattern)) {
    let i = 0;
    for (const child of pattern.children) {
      if (nodes.isHole(child)) {
        i++;
        continue;
      }
      if (nodes.isRestPattern(child)) {
        const childSource = arraySlice(source, i);
        compileDestructuring(ctx, frame, child.target, childSource);
        break;
      }
      let childSource = safeArrayIndex(source, i);
      if (nodes.isAssignmentPattern(child)) {
        const defaultId = uniqueId('__dflt');
        ctx._emitLine(`let ${defaultId} = (${childSource}) === undefined ? (`);
        ctx._compileExpression(child.value, frame);
        ctx._emitLine(`) : ${childSource};`);
        childSource = defaultId;
        compileDestructuring(ctx, frame, child.target, childSource);
      } else {
        compileDestructuring(ctx, frame, child, childSource);
      }
      i++;
    }
    return;
  }

  if (nodes.isObjectPattern(pattern)) {
    for (const child of pattern.children) {
      if (nodes.isRestPattern(child)) {
        const restId = uniqueId('__rest');
        const childSource = objectRest(source, restId);
        compileDestructuring(ctx, frame, child.target, childSource);
        continue;
      }
      if (nodes.isPatternProperty(child)) {
        let propSource = safeMemberLookup(source, child.key);
        if (nodes.isAssignmentPattern(child.value)) {
          const defaultId = uniqueId('__dflt');
          ctx._emitLine(`let ${defaultId} = (${propSource}) === undefined ? (`);
          ctx._compileExpression(child.value.value, frame);
          ctx._emitLine(`) : ${propSource};`);
          propSource = defaultId;
          compileDestructuring(ctx, frame, child.value.target, propSource);
        } else {
          compileDestructuring(ctx, frame, child.value, propSource);
        }
      }
    }
    return;
  }
};

export { compileDestructuring };
