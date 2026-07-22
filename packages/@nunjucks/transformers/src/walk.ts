// Walk utilities now live in @nunjucks/nodes/traverse (canonical).
// This module re-exports them for backward compatibility.
// Import directly: import { walk, findAll } from '@nunjucks/transformers/walk'

export {
  mapCOW, walk, depthWalk, findAll, findFirst, count, iterateNodes as nodes,
  filterNodes, getType, getFields_, getNodeTypeName, getNodeFields, addChild,
} from '@nunjucks/nodes/traverse';
