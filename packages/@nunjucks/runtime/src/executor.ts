import { createContext, type Env, type Context } from './context.ts';
import type { Frame } from './frame.ts';
import { createRenderRuntime, type RenderRuntime } from './render-runtime.ts';
import { getRenderFunction, buildSandboxOptions, buildSandboxedRuntime } from './executor-runtime.ts';
import { collectString } from './collect-stream.ts';
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

// WHY: blocks must flow through createContext so they live in the immutable Context's state closure (where addBlock/getBlock read), not just on a bypassed property. The old `ctx.blocks = blocks` direct assignment was invisible to the closure-based immutable methods.
const buildContextObject = (
  context: Record<string, unknown>,
  env: Env,
  blocks: Record<string, unknown>,
): Context => {
  return createContext({ ctx: context, env, blocks });
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
  context: Record<string, unknown>,
  frame: Frame,
  env: Env,
  runtime: RenderRuntime
): Promise<string> => {
  const { render, blocks } = getRenderFunction(code);
  const ctx = buildContextObject(context, env, blocks);

  // WHY: root is now an async generator that yields output chunks; drain it into a string for blocking rendering. (Option B streaming pivot.)
  return collectString(render(env, ctx, frame, runtime));
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

  return executeNonSandbox(code, context, frame, resolvedEnv, runtime);
};

// WHY: streaming counterpart of execute — returns the root async generator WITHOUT draining, so renderToStream can hand it to a consumer (HTTP response pipe) that reads chunks incrementally. No executionTimeout here: a generator cannot be cleanly wrapped by withTimeout (it is not a Promise); streaming timeout is the consumer's responsibility.
const executeStream = (
  code: string,
  context: Record<string, unknown>,
  frame: Frame,
  env: Env | null,
  config: ExecuteConfig = {}
): AsyncGenerator<string, unknown> => {
  const resolvedEnv = env ?? defaultEnv(config);
  const runtime = buildRuntime(config);
  const { render, blocks } = getRenderFunction(code);
  const ctx = buildContextObject(context, resolvedEnv, blocks);

  return render(resolvedEnv, ctx, frame, runtime);
};

export { execute, executeStream };
export type { ExecuteConfig, SandboxMode };
