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
    const originalRender = (view, options) => res.render(view, options);
    res.render = async function(view, options) {
      try {
        return await originalRender(view, options);
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
