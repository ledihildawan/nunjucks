import { collectString } from '@nunjucks/lib/collect-stream';
import type { Environment, SandboxMode } from '@nunjucks/shared';
import { createContext, type Env } from './context.ts';
import {
  buildSandboxedRuntime,
  buildSandboxOptions,
  getRenderFunction,
} from './executor-runtime.ts';
import type { Frame } from './frame.ts';
import { createRenderRuntime, type RenderRuntime } from './render-runtime.ts';

interface ExecuteConfig {
  autoescape?: boolean;
  dev?: boolean;
  sandbox?: boolean;
  sandboxAllowlist?: readonly string[];
  sandboxMode?: SandboxMode;
  sandboxEnvironment?: Environment;
  executionTimeoutMs?: number;
}

interface ExecuteOptions {
  code: string;
  context: Record<string, unknown>;
  frame: Frame;
  env: Env | null;
  config?: ExecuteConfig;
}

interface ExecuteNonSandboxOptions {
  code: string;
  context: Record<string, unknown>;
  frame: Frame;
  env: Env;
  runtime: RenderRuntime;
  executionTimeoutMs: number | undefined;
}

interface DeadlineTimeoutError extends Error {
  code: string;
}

// WHY: a wall-clock withTimeout(promise, ms) cannot preempt the blocking render — the drain is a
// microtask-only chain (for-await over the compiled async generator), so macrotask timers starve
// until it settles. The deadline is therefore checked cooperatively at every chunk boundary;
// a render that never yields cannot be interrupted (documented limitation).
const createDeadlineTimeoutError = (timeoutMs: number): DeadlineTimeoutError => {
  const timeoutError = new Error(
    `Template rendering timed out after ${timeoutMs}ms`
  ) as DeadlineTimeoutError;
  timeoutError.name = 'TimeoutError';
  timeoutError.code = 'TIMEOUT';
  return timeoutError;
};

const collectStringWithDeadline = async (
  stream: AsyncIterable<string>,
  timeoutMs: number
): Promise<string> => {
  const deadlineAt = Date.now() + timeoutMs;
  const chunks: string[] = [];
  for await (const chunk of stream) {
    if (Date.now() > deadlineAt) {
      throw createDeadlineTimeoutError(timeoutMs);
    }
    chunks.push(chunk);
  }
  return chunks.join('');
};

const buildRuntime = (config: ExecuteConfig): RenderRuntime => {
  const runtime = createRenderRuntime();

  if (config.sandbox) {
    const sandboxOptions = buildSandboxOptions(config);
    return buildSandboxedRuntime(runtime, sandboxOptions);
  }

  return runtime;
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

const executeNonSandbox = async (options: ExecuteNonSandboxOptions): Promise<string> => {
  const { code, context, frame, env, runtime, executionTimeoutMs } = options;
  const { render, blocks } = getRenderFunction(code);
  const ctx = createContext({ ctx: context, env, blocks });

  const stream = render(env, ctx, frame, runtime);
  return executionTimeoutMs && executionTimeoutMs > 0
    ? collectStringWithDeadline(stream, executionTimeoutMs)
    : collectString(stream);
};

const execute = async (options: ExecuteOptions): Promise<string> => {
  const { code, context, frame, env, config = {} } = options;
  const resolvedEnv = env ?? defaultEnv(config);
  const runtime = buildRuntime(config);

  return executeNonSandbox({
    code,
    context,
    frame,
    env: resolvedEnv,
    runtime,
    executionTimeoutMs: config.executionTimeoutMs,
  });
};

const executeStream = (options: ExecuteOptions): AsyncGenerator<string, unknown> => {
  const { code, context, frame, env, config = {} } = options;
  const resolvedEnv = env ?? defaultEnv(config);
  const runtime = buildRuntime(config);
  const { render, blocks } = getRenderFunction(code);
  const ctx = createContext({ ctx: context, env: resolvedEnv, blocks });

  return render(resolvedEnv, ctx, frame, runtime);
};

export type { ExecuteConfig, ExecuteOptions, SandboxMode };
export { execute, executeStream };
