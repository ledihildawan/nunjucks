import { createContext, type Env, type Context } from './context.ts';
import type { Frame } from './frame.ts';
import { createRenderRuntime, type RenderRuntime } from './render-runtime.ts';
import { getRenderFunction, buildSandboxOptions, buildSandboxedRuntime } from './executor-runtime.ts';
import type { Environment } from '@nunjucks/shared';

type SandboxMode = 'allowlist' | 'blocklist';

interface ExecuteConfig {
  autoescape?: boolean;
  dev?: boolean;
  sandbox?: boolean;
  sandboxAllowlist?: readonly string[];
  sandboxMode?: SandboxMode;
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
  return createContext({ ctx: context, env });
};

const defaultEnv = (config: ExecuteConfig): Env => ({
  opts: {
    dev: false,
    autoescape: config.autoescape ?? true,
    undefined: 'default',
  },
  getFilter: () => null,
  getTest: () => null,
});

const executeNonSandbox = async (
  code: string,
  ctx: Context,
  frame: Frame,
  env: Env,
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
  env: Env | null,
  config: ExecuteConfig = {}
): Promise<string> => {
  const resolvedEnv = env ?? defaultEnv(config);
  const runtime = buildRuntime(config);
  const ctx = buildContextObject(context, resolvedEnv);

  return await executeNonSandbox(code, ctx, frame, resolvedEnv, runtime);
};

export { execute };
export type { ExecuteConfig, SandboxMode };
