import { describe, test, expect, mock } from 'bun:test';
import express from './express-app.js';

describe('express', () => {
  test('calls app.set with view function', () => {
    const setMock = mock();
    const useMock = mock();
    const app = { set: setMock, use: useMock };
    const env = { render: mock(() => 'rendered'), opts: { dev: false } };

    const result = express(env, app);

    expect(setMock).toHaveBeenCalledTimes(2);
    expect(setMock).toHaveBeenCalledWith('view', expect.any(Function));
    expect(setMock).toHaveBeenCalledWith('nunjucksEnv', env);
    expect(result).toBe(env);
  });

  test('view function returns object with render method that calls env.render', async () => {
    const setMock = mock();
    const useMock = mock();
    let viewFn;
    setMock.mockImplementation((key, fn) => {
      if (key === 'view') viewFn = fn;
    });
    const app = { set: setMock, use: useMock };
    const env = { render: mock(() => 'rendered'), opts: { dev: false } };

    express(env, app);

    const view = viewFn('template.html');
    expect(view.name).toBe('template.html');
    expect(typeof view.render).toBe('function');

    const result = await view.render({ key: 'val' });
    expect(env.render).toHaveBeenCalledWith('template.html', { key: 'val' });
    expect(result).toBe('rendered');
  });

  test('returns the environment', () => {
    const setMock = mock();
    const useMock = mock();
    const app = { set: setMock, use: useMock };
    const env = { render: mock(), opts: { dev: false } };

    const result = express(env, app);

    expect(result).toBe(env);
  });
});
