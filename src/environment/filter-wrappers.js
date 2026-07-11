const tagError = (err, name) => {
  err.code = err.code || 'FILTER_ERROR';
  err.subject = err.subject || name;
  return err;
};

export const wrapAsyncFilter = (filter, name) => {
  return async function(...args) {
    const resolvedArgs = await Promise.all(args);
    try {
      const result = filter.apply(this, resolvedArgs);
      return result && typeof result.then === 'function' ? await result : result;
    } catch (err) {
      throw tagError(err, name);
    }
  };
};
