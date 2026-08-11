import { createLog } from '@nunjucks/error-formatter';
import type { WarningContext } from '@nunjucks/error-formatter';
import { MATCH_ANY_RE } from '@nunjucks/lib';
import type { Phase } from '@nunjucks/shared';

export interface EmitUndefinedWarningOptions {
	name: string;
	message: () => string;
	subject: string | null;
	lineno?: number | null;
	colno?: number | null;
	phase: Phase;
	templateName: string;
	mode: 'chainable' | 'strict' | 'debug';
	varName: string | null;
}

export const emitUndefinedWarning = (self: unknown, options: EmitUndefinedWarningOptions): void => {
	const warning = createLog('warning', {
		def: {
			name: options.name,
			message: options.message,
			pattern: MATCH_ANY_RE,
		},
		params: {},
		subject: options.subject,
		context: {
			lineno: options.lineno ?? null,
			colno: options.colno ?? null,
			phase: options.phase,
			templateName: options.templateName,
			undefinedMode: options.mode,
			varName: options.varName,
			lineBase: 'zero',
		} as WarningContext,
	});
	const collector = self && typeof self === 'object'
		? (self as { __warnings__?: unknown[] }).__warnings__
		: undefined;
	if (Array.isArray(collector)) {
		collector.push(warning);
	} else {
		// biome-ignore lint/suspicious/noConsole: documented fallback when no warning collector is attached to the render.
		console.warn(warning.message);
	}
};
