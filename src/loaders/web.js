import { createLoader } from './base.js';

const addCacheBust = (url) => {
  const separator = url.indexOf('?') === -1 ? '?' : '&';
  return url + separator + 's=' + new Date().getTime();
};

const isBrowser = () => typeof window !== 'undefined';

const createAjaxHandler = (resolve, reject) => {
  let loading = true;
  return (ajax) => {
    if (ajax.readyState === 4 && loading) {
      loading = false;
      if (ajax.status === 0 || ajax.status === 200) {
        resolve(ajax.responseText);
      } else {
        reject({ status: ajax.status, content: ajax.responseText });
      }
    }
  };
};

const fetchUrl = (async) => (url) =>
  new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error('WebLoader can only be used in a browser'));
      return;
    }

    const ajax = new XMLHttpRequest();
    const handler = createAjaxHandler(resolve, reject);
    ajax.onreadystatechange = () => handler(ajax);
    ajax.open('GET', url, async);
    ajax.send();
  });

export function createWebLoader(baseURL, opts = {}) {
  const loader = createLoader();
  loader.typename = 'WebLoader';
  loader.baseURL = baseURL || '.';
  loader.useCache = !!opts.useCache;
  loader.async = true;

  loader.resolve = () => {
    throw new Error('relative templates not supported in the browser yet');
  };

  loader.getSource = async (name) => {
    const url = loader.baseURL + '/' + name;
    const cacheBustedUrl = addCacheBust(url);

    try {
      const src = await fetchUrl(loader.async)(cacheBustedUrl);
      const result = {
        src,
        path: name,
        noCache: !loader.useCache
      };
      loader.emit('load', name, result);
      return result;
    } catch (err) {
      if (err && err.status === 404) return null;
      if (err && err.content !== undefined) throw err.content;
      throw err;
    }
  };

  return loader;
}
