import { createContext, type Env, type Context } from './context.ts';
import type { Frame } from './frame.ts';
import { createRenderRuntime, type RenderRuntime } from './render-runtime.ts';
import { getRenderFunction, buildSandboxOptions, buildSandboxedRuntime } from './executor-runtime.ts';
import type { Environment, RenderResult } from '@nunjucks/shared';

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

// WHY: blocks must flow through createContext so they live in the immutable Context's state closure (where addBlock/getBlock read), not just on a bypassed property. The old `ctx.blocks = blocks` direct assignment was invisible to the closure-based immutable methods.
const buildContextObject = (
  context: Record<string, unknown>,
  env: Env,
  blocks: Record<string, unknown>,
): Context => {
  return createContext({ ctx: context, env, blocks });
};

const unwrapOutput = (result: RenderResult): string =>
  Array.isArray(result) ? result[0] : result;

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
  context: Record<string, unknown>,
  frame: Frame,
  env: Env,
  runtime: RenderRuntime
): Promise<string> => {
  const { render, blocks } = getRenderFunction(code);
  const ctx = buildContextObject(context, env, blocks);

  return unwrapOutput(await render(env, ctx, frame, runtime));
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

  return await executeNonSandbox(code, context, frame, resolvedEnv, runtime);
};

export { execute };
export type { ExecuteConfig, SandboxMode };
