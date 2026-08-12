import { createContext, type Env } from './context.ts';
import type { Frame } from './frame.ts';
import { createRenderRuntime, type RenderRuntime } from './render-runtime.ts';
import { getRenderFunction, buildSandboxOptions, buildSandboxedRuntime } from './executor-runtime.ts';
import { collectString } from './collect-stream.ts';
import type { Environment } from '@nunjucks/validators/security';

type SandboxMode = 'allowlist' | 'blocklist';

interface ExecuteConfig {
	autoescape?: boolean;
	dev?: boolean;
	sandbox?: boolean;
	sandboxAllowlist?: readonly string[];
	sandboxMode?: SandboxMode;
	sandboxEnvironment?: Environment;
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
}

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
	const { code, context, frame, env, runtime } = options;
	const { render, blocks } = getRenderFunction(code);
	const ctx = createContext({ ctx: context, env, blocks });

	return collectString(render(env, ctx, frame, runtime));
};

const execute = async (options: ExecuteOptions): Promise<string> => {
	const { code, context, frame, env, config = {} } = options;
	const resolvedEnv = env ?? defaultEnv(config);
	const runtime = buildRuntime(config);

	return executeNonSandbox({ code, context, frame, env: resolvedEnv, runtime });
};

const executeStream = (
	options: ExecuteOptions,
): AsyncGenerator<string, unknown> => {
	const { code, context, frame, env, config = {} } = options;
	const resolvedEnv = env ?? defaultEnv(config);
	const runtime = buildRuntime(config);
	const { render, blocks } = getRenderFunction(code);
	const ctx = createContext({ ctx: context, env, blocks });

	return render(resolvedEnv, ctx, frame, runtime);
};

export { execute, executeStream };
export type { ExecuteOptions, ExecuteNonSandboxOptions, ExecuteConfig, SandboxMode };
