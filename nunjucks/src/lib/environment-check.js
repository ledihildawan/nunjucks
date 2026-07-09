export const isDevelopment = () => {
  const env = typeof process !== 'undefined' ? process.env?.NODE_ENV : '';
  return env !== 'production' && env !== 'test';
};
