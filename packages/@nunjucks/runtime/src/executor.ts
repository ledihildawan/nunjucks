import { ERROR_CODES } from '@nunjucks/error-catalog';
import { collectString } from '@nunjucks/lib';
import type { Environment, SandboxMode } from '@nunjucks/shared';
import { createContext, createDefaultEnv, type Env } from './context.ts';
import {
  buildSandboxedRuntime,
  buildSandboxOptions,
  getRenderFunction,
} from './executor-runtime.ts';
import type { Frame } from './frame.ts';
import { createRenderRuntime, type RenderRuntime } from './render-runtime.ts';

/**
 * Execution knobs for a render: escaping, sandboxing, timeout, and the
 * diagnostics channel (`templateName`, `renderContext`, `warningsCollector`)
 * that error enrichment and dev-mode warnings read from.
 */
interface ExecuteConfig {
  autoescape?: boolean;
  dev?: boolean;
  sandbox?: boolean;
  sandboxAllowlist?: readonly string[];
  sandboxMode?: SandboxMode;
  sandboxEnvironment?: Environment;
  executionTimeoutMs?: number;
  // WHY: diagnostics channel — templateName feeds error enrichment (logContext) and
  // warningsCollector is the array the runtime pushes undefined-mode warnings onto;
  // the caller keeps the reference and drains it after the render.
  templateName?: string;
  renderContext?: unknown;
  warningsCollector?: unknown[];
}

/** Inputs to `execute`/`executeStream`: compiled code, context, frame, env, and config. */
interface ExecuteOptions {
  code: string;
  context: Record<string, unknown>;
  frame: Frame;
  env: Env | null;
  config?: ExecuteConfig;
}

interface ExecuteWithRuntimeOptions {
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
  timeoutError.code = ERROR_CODES.TIMEOUT;
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
  // WHY: diagnostics options are always threaded (fields optional) so logContext and
  // the warnings slot exist even under the sandbox wrapper's spread.
  const runtime = createRenderRuntime({
    templateName: config.templateName,
    renderContext: config.renderContext,
    warnings: config.warningsCollector,
  });

  if (config.sandbox) {
    const sandboxOptions = buildSandboxOptions(config);
    return buildSandboxedRuntime(runtime, sandboxOptions);
  }

  return runtime;
};

// WHY: derives from the canonical bare Env (context.ts) so the executor default cannot
// drift from the context default; only autoescape is config-overridable here.
const defaultEnv = (config: ExecuteConfig): Env => {
  const base = createDefaultEnv();
  return { ...base, opts: { ...base.opts, autoescape: config.autoescape ?? true } };
};

// WHY: named for what it consumes — an already-built runtime. It executes both sandboxed and
// non-sandboxed configs; sandboxing (when enabled) lives in the swapped runtime.memberLookup.

// WHY: execute/executeStream share the load-validate + createContext + render-entry
// sequence; the helper yields the ready-to-drain stream so each public entry only
// decides drain policy (collect under deadline vs hand the generator to the caller).
interface StartRenderStreamOptions {
  code: string;
  context: Record<string, unknown>;
  frame: Frame;
  env: Env;
  runtime: RenderRuntime;
}

const startRenderStream = ({
  code,
  context,
  frame,
  env,
  runtime,
}: StartRenderStreamOptions): AsyncGenerator<string, unknown> => {
  const { render, blocks } = getRenderFunction(code);
  const ctx = createContext({ ctx: context, env, blocks });
  return render(env, ctx, frame, runtime);
};

const executeWithRuntime = async (options: ExecuteWithRuntimeOptions): Promise<string> => {
  const stream = startRenderStream(options);
  const { executionTimeoutMs } = options;
  return executionTimeoutMs && executionTimeoutMs > 0
    ? collectStringWithDeadline(stream, executionTimeoutMs)
    : collectString(stream);
};

// WHY: both public entries share the env-defaulting + runtime-building resolution;
// only what they do with the resulting stream differs.
const resolveEnvAndRuntime = (options: ExecuteOptions): { env: Env; runtime: RenderRuntime } => {
  const { env, config = {} } = options;
  return { env: env ?? defaultEnv(config), runtime: buildRuntime(config) };
};

/**
 * Renders compiled template code to a string — building the runtime (sandboxed
 * or plain), defaulting the `Env` from config, and draining the render stream
 * under the configured cooperative wall-clock deadline when one is set.
 */
const execute = async (options: ExecuteOptions): Promise<string> => {
  const { code, context, frame, config = {} } = options;
  const { env, runtime } = resolveEnvAndRuntime(options);
  return executeWithRuntime({
    code,
    context,
    frame,
    env,
    runtime,
    executionTimeoutMs: config.executionTimeoutMs,
  });
};

/**
 * Renders compiled template code as its underlying async generator, applying
 * the same env/runtime/sandbox resolution as `execute` but leaving chunk
 * consumption — and therefore timeout policy — to the caller.
 */
const executeStream = (options: ExecuteOptions): AsyncGenerator<string, unknown> => {
  const { code, context, frame } = options;
  const { env, runtime } = resolveEnvAndRuntime(options);
  return startRenderStream({ code, context, frame, env, runtime });
};

export type { ExecuteConfig, ExecuteOptions };
export { execute, executeStream };
