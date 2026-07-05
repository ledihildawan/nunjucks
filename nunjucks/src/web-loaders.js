import Loader from './loader.js';
import {PrecompiledLoader} from './precompiled-loader.js';

export class WebLoader extends Loader {
  constructor(baseURL, opts) {
    super();
    this.baseURL = baseURL || '.';
    opts = opts || {};

    this.useCache = !!opts.useCache;
    this.async = !!opts.async;
  }

  resolve(from, to) {
    throw new Error('relative templates not support in the browser yet');
  }

  getSource(name, cb) {
    var useCache = this.useCache;
    var result;
    this.fetch(this.baseURL + '/' + name, (err, src) => {
      if (err) {
        if (cb) {
          cb(err.content);
        } else if (err.status === 404) {
          result = null;
        } else {
          throw err.content;
        }
      } else {
        result = {
          src: src,
          path: name,
          noCache: !useCache
        };
        this.emit('load', name, result);
        if (cb) {
          cb(null, result);
        }
      }
    });

    return result;
  }

  fetch(url, cb) {
    if (typeof window === 'undefined') {
      throw new Error('WebLoader can only by used in a browser');
    }

    const ajax = new XMLHttpRequest();
    let loading = true;

    ajax.onreadystatechange = () => {
      if (ajax.readyState === 4 && loading) {
        loading = false;
        if (ajax.status === 0 || ajax.status === 200) {
          cb(null, ajax.responseText);
        } else {
          cb({
            status: ajax.status,
            content: ajax.responseText
          });
        }
      }
    };

    url += (url.indexOf('?') === -1 ? '?' : '&') + 's=' +
    (new Date().getTime());

    ajax.open('GET', url, this.async);
    ajax.send();
  }
}

export {PrecompiledLoader};
