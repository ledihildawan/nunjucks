import { Output, TemplateData } from '../../nodes.js';
import { advanceAfterBlockEnd } from '../cursor.js';

export const parseRaw = (ctx, tagName) => {
  tagName = tagName || 'raw';
  const endTagName = 'end' + tagName;
  const rawBlockRegex = new RegExp('([\\s\\S]*?){%\\s*(' + tagName + '|' + endTagName + ')\\s*(?=%})%}');
  let rawLevel = 1;
  let str = '';
  let matches = null;

  const begun = advanceAfterBlockEnd(ctx);

  while ((matches = ctx.tokens._extractRegex(rawBlockRegex)) && rawLevel > 0) {
    const all = matches[0];
    const pre = matches[1];
    const blockName = matches[2];

    if (blockName === tagName) {
      rawLevel += 1;
    } else if (blockName === endTagName) {
      rawLevel -= 1;
    }

    if (rawLevel === 0) {
      str += pre;
      ctx.tokens.backN(all.length - pre.length);
    } else {
      str += all;
    }
  }

  return new Output(
    begun.lineno,
    begun.colno,
    [new TemplateData(begun.lineno, begun.colno, str)]
  );
};
