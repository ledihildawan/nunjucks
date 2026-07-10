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

  app.use((req, res, next) => {
    const originalRender = res.render.bind(res);
    res.render = async function(view, options, callback) {
      try {
        return await originalRender(view, options, callback);
      } catch (e) {
        if (env.opts.dev) {
          const err = await env.getErrorFormatter().formatError(e, view, {
            renderContext: { ...req.params, ...req.query, ...(options || {}) },
          });
          console.error(err.toConsoleString());
          res.status(500).send(err.toHtmlString());
        } else {
          next(e);
        }
      }
    };
    next();
  });

  return env;
};
