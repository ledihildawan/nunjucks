import { createContext, type ContextEnv, type Context } from './context.ts';
import type { Frame } from './frame.ts';
import { createRenderRuntime } from './render-runtime.ts';
import { getRenderFunction, buildSandboxOptions, buildSandboxedRuntime } from './executor-runtime.ts';

interface ExecuteConfig {
  autoescape?: boolean;
  dev?: boolean;
  sandbox?: boolean;
  sandboxAllowlist?: readonly string[];
  sandboxMode?: string;
  sandboxEnvironment?: string;
}

const buildRuntime = (config: ExecuteConfig): Record<string, unknown> => {
  const runtime = createRenderRuntime() as Record<string, unknown>;

  if (config.sandbox) {
    const sandboxOptions = buildSandboxOptions(config);
    return buildSandboxedRuntime(runtime, sandboxOptions);
  }

  return runtime;
};

const buildContextObject = (
  context: Record<string, unknown>,
  env: ContextEnv,
  autoescape: boolean | undefined
): Context => {
  const ctx = createContext(context, {}, env);
  ctx._autoescape = autoescape ?? true;
  return ctx;
};

const executeNonSandbox = async (
  code: string,
  ctx: Context,
  frame: Frame,
  env: unknown,
  runtime: Record<string, unknown>
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
  const resolvedEnv = (env ?? { opts: { dev: false, autoescape: true, undefined: 'default' }, getFilter: () => null, getTest: () => null }) as ContextEnv;
  const runtime = buildRuntime(config);
  const ctx = buildContextObject(context, resolvedEnv, config.autoescape);

  return await executeNonSandbox(code, ctx, frame, env, runtime);
};

export { execute };
export type { ExecuteConfig };
