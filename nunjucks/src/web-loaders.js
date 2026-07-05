import Loader from './loader.js';
export {PrecompiledLoader} from './precompiled-loader.js';

export class WebLoader extends Loader {
  constructor(baseURL, opts) {
    super();
    this.baseURL = baseURL || '.';
    opts = opts || {};

    this.useCache = !!opts.useCache;
    this.async = true;
  }

  resolve(from, to) {
    throw new Error('relative templates not support in the browser yet');
  }

  async getSource(name) {
    var useCache = this.useCache;
    var result;

    try {
      const src = await this.fetch(this.baseURL + '/' + name);
      result = {
        src: src,
        path: name,
        noCache: !useCache
      };
      this.emit('load', name, result);
      return result;
    } catch (err) {
      if (err.status === 404) {
        return null;
      } else {
        throw err.content;
      }
    }
  }

  async fetch(url) {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('WebLoader can only by used in a browser'));
        return;
      }

      const ajax = new XMLHttpRequest();
      let loading = true;

      ajax.onreadystatechange = () => {
        if (ajax.readyState === 4 && loading) {
          loading = false;
          if (ajax.status === 0 || ajax.status === 200) {
            resolve(ajax.responseText);
          } else {
            reject({
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
    });
  }
}
