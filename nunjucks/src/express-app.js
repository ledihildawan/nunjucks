import path from 'path';

export default function express(env, app) {
  app.set('view', function(name, opts) {
    return {
      name: name,
      render: async function(opts) {
        return await env.render(name, opts);
      }
    };
  });
  app.set('nunjucksEnv', env);
  return env;
};
