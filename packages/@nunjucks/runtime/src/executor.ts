import { createContext, type Env, type Context } from './context.ts';
import type { Frame } from './frame.ts';
import { createRenderRuntime, type RenderRuntime } from './render-runtime.ts';
import { getRenderFunction, buildSandboxOptions, buildSandboxedRuntime } from './executor-runtime.ts';
import type { Environment } from '@nunjucks/shared';

interface ExecuteConfig {
  autoescape?: boolean;
  dev?: boolean;
  sandbox?: boolean;
  sandboxAllowlist?: readonly string[];
  sandboxMode?: string;
  sandboxEnvironment?: Environment;
}

const buildRuntime = (config: ExecuteConfig): RenderRuntime => {
  const runtime = createRenderRuntime();

  if (config.sandbox) {
    const sandboxOptions = buildSandboxOptions(config);
    return buildSandboxedRuntime(runtime, sandboxOptions);
  }

  return runtime;
};

const buildContextObject = (
  context: Record<string, unknown>,
  env: Env,
): Context => {
  return createContext(context, {}, env);
};

const executeNonSandbox = async (
  code: string,
  ctx: Context,
  frame: Frame,
  env: unknown,
  runtime: RenderRuntime
): Promise<string> => {
  const { render, blocks } = getRenderFunction(code);

  ctx.blocks = blocks;

  return await render(env, ctx, frame, runtime);
};

const execute = async (
  code: string,
  context: Record<string, unknown>,
  frame: Frame,
  env: unknown,
  config: ExecuteConfig = {}
): Promise<string> => {
  const resolvedEnv = (env ?? { opts: { dev: false, autoescape: config.autoescape ?? true, undefined: 'default' }, getFilter: () => null, getTest: () => null }) as Env;
  const runtime = buildRuntime(config);
  const ctx = buildContextObject(context, resolvedEnv);

  return await executeNonSandbox(code, ctx, frame, resolvedEnv, runtime);
};

export { execute };
export type { ExecuteConfig };
