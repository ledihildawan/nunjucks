import { isNonNullish } from '@nunjucks/lib';
import { isNullAccessResult, isPropertyNotFoundResult } from './member-access.ts';
import { getLogContext } from './log-context.ts';
import { resolveUndefinedProperty, resolveNullAccess, resolveUndefinedValue, type ResolveUndefinedOptions } from './undefined-rules.ts';

export interface EnsureDefinedOptions {
	lineno?: number | null;
	colno?: number | null;
	varName?: string | null;
	undefinedMode?: 'chainable' | 'strict' | 'debug';
}

export function ensureDefined(
	this: unknown,
	value: unknown,
	options: EnsureDefinedOptions = {}
): unknown {
	const { lineno, colno, varName = null, undefinedMode = 'chainable' } = options;
	if (isPropertyNotFoundResult(value) || isNullAccessResult(value)) {
		const ctx = getLogContext(this);
		const effectiveTemplateName = ctx.templateName ?? 'inline';
		const resolveOptions: ResolveUndefinedOptions = {
			self: this,
			val: value,
			varName,
			lineno,
			colno,
			mode: undefinedMode,
			phase: ctx.phase ?? 'render',
			templateName: effectiveTemplateName,
		};
		if (isPropertyNotFoundResult(value)) {
			return resolveUndefinedProperty(value, resolveOptions);
		}
		return resolveNullAccess(value, resolveOptions);
	}

	if (!isNonNullish(value)) {
		const ctx = getLogContext(this);
		const effectiveTemplateName = ctx.templateName ?? 'inline';
		return resolveUndefinedValue({
			self: this,
			val: value,
			varName,
			lineno,
			colno,
			mode: undefinedMode,
			phase: ctx.phase ?? 'render',
			templateName: effectiveTemplateName,
		});
	}

	return value;
}
