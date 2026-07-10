import { describe, test, expect, mock } from 'bun:test';
import express from './express-app.js';

describe('express', () => {
  test('calls app.set with view function', () => {
    const setMock = mock();
    const app = { set: setMock };
    const env = { render: mock(() => 'rendered') };

    const result = express(env, app);

    expect(setMock).toHaveBeenCalledTimes(2);
    expect(setMock).toHaveBeenCalledWith('view', expect.any(Function));
    expect(setMock).toHaveBeenCalledWith('nunjucksEnv', env);
    expect(result).toBe(env);
  });

  test('view function returns object with render method that calls env.render', async () => {
    const setMock = mock();
    let viewFn;
    setMock.mockImplementation((key, fn) => {
      if (key === 'view') viewFn = fn;
    });
    const app = { set: setMock };
    const env = { render: mock(() => 'rendered') };

    express(env, app);

    const view = viewFn('template.html');
    expect(view.name).toBe('template.html');
    expect(typeof view.render).toBe('function');

    const result = await view.render({ key: 'val' });
    expect(env.render).toHaveBeenCalledWith('template.html', { key: 'val' });
    expect(result).toBe('rendered');
  });

  test('returns the environment', () => {
    const app = { set: mock() };
    const env = { render: mock() };

    const result = express(env, app);

    expect(result).toBe(env);
  });
});
