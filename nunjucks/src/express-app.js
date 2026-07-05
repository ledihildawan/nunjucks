export default function express(env, app) {
  app.set('view', function(name) {
    return {
      name: name,
      render: async function(renderOpts) {
        return await env.render(name, renderOpts);
      }
    };
  });
  app.set('nunjucksEnv', env);
  return env;
};
