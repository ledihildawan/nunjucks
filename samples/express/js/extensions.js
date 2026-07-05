'use strict';

class RemoteExtension {
  constructor() {
    this.tags = ['remote'];
  }

  parse(parser, nodes, lexer) {
    const tok = parser.nextToken();
    const args = parser.parseSignature(null, true);
    parser.advanceAfterBlockEnd(tok.value);

    const body = parser.parseUntilBlocks('error', 'endremote');
    let errorBody = null;

    if (parser.skipSymbol('error')) {
      parser.skip(lexer.TOKEN_BLOCK_END);
      errorBody = parser.parseUntilBlocks('endremote');
    }

    parser.advanceAfterBlockEnd();

    return new nodes.CallExtension(this, 'run', args, [body, errorBody]);
  }

  run(context, url, body, errorBody) {
    const id = 'el' + Math.floor(Math.random() * 10000);
    const ret = new nunjucks.runtime.SafeString('<div id="' + id + '">' + body() + '</div>');
    const ajax = new XMLHttpRequest();

    ajax.onreadystatechange = () => {
      if (ajax.readyState === 4) {
        if (ajax.status === 200) {
          document.getElementById(id).innerHTML = ajax.responseText;
        } else {
          document.getElementById(id).innerHTML = errorBody();
        }
      }
    };

    ajax.open('GET', url, true);
    ajax.send();

    return ret;
  }
}
