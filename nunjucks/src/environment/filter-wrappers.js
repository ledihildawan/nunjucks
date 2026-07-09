export const wrapFilterWithError = (filter, name) => {
  const tag = (err) => {
    err.code = err.code || 'FILTER_ERROR';
    err.subject = err.subject || name;
    return err;
  };

  return function(...args) {
    if (!args.some(a => a && typeof a.then === 'function')) {
      try {
        return filter.apply(this, args);
      } catch (err) {
        throw tag(err);
      }
    }
    return Promise.all(args).then(resolved => {
      try {
        return filter.apply(this, resolved);
      } catch (err) {
        throw tag(err);
      }
    });
  };
};

export const wrapAsyncFilter = (filter, name) => {
  const tag = (err) => {
    err.code = err.code || 'FILTER_ERROR';
    err.subject = err.subject || name;
    return err;
  };

  return async function(...args) {
    const resolvedArgs = await Promise.all(args.map(async arg => {
      if (arg && typeof arg.then === 'function') return arg.then(v => v);
      return arg;
    }));
    try {
      return await filter.apply(this, resolvedArgs);
    } catch (err) {
      throw tag(err);
    }
  };
};
