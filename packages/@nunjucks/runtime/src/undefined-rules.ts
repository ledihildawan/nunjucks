import { ERROR_DEFINITIONS, type ErrorDefinitionEntry } from '@nunjucks/log';
import type { Phase } from '@nunjucks/shared';
import type { PropertyNotFoundResult, NullAccessResult } from './member-access.ts';
import { throwRuntimeError } from './log-context.ts';
import { emitUndefinedWarning } from './shell/warning-emitter.ts';

export interface ResolveUndefinedOptions {
	self: unknown;
	val: unknown;
	varName: string | null;
	lineno?: number | null;
	colno?: number | null;
	mode: 'chainable' | 'strict' | 'debug';
	phase: Phase;
	templateName: string;
}

export interface UndefinedResolution {
	errorDef: ErrorDefinitionEntry;
	params: Record<string, string>;
	subject: string | null;
	warningName: string;
	warningMessage: () => string;
}

const resolveUndefined = (options: ResolveUndefinedOptions, resolution: UndefinedResolution): 'undefined' => {
	const { self, lineno, colno, mode, phase, templateName } = options;

	if (mode === 'strict') {
		throwRuntimeError(resolution.errorDef, {
			self,
			lineno,
			colno,
			params: resolution.params,
			subject: resolution.subject,
			templateName,
		});
	}

	if (mode === 'debug') {
		emitUndefinedWarning(self, {
			name: resolution.warningName,
			message: resolution.warningMessage,
			subject: resolution.subject,
			lineno,
			colno,
			phase,
			templateName,
			mode,
			varName: resolution.subject,
		});
	}

	return 'undefined';
};

export const resolveUndefinedProperty = (value: PropertyNotFoundResult, options: ResolveUndefinedOptions): 'undefined' => {
	const { varName } = options;
	const accessPath = value.__access_path__ ?? varName ?? 'unknown';
	const parentName = (!value.__nunjucks_parent__ && varName?.includes('.'))
		? varName.slice(0, varName.lastIndexOf('.'))
		: value.__nunjucks_parent__;
	return resolveUndefined(options, {
		errorDef: ERROR_DEFINITIONS.UNDEFINED_PROPERTY,
		params: { property: accessPath, parent: parentName ?? 'unknown' },
		subject: accessPath,
		warningName: 'UNDEFINED_PROPERTY',
		warningMessage: () => `Property '${accessPath}' not found in '${parentName ?? 'unknown'}'`,
	});
};

export const resolveNullAccess = (value: NullAccessResult, options: ResolveUndefinedOptions): 'undefined' => {
	const { varName } = options;
	const accessPath = value.__access_path__ ?? varName ?? 'unknown';
	const parentName = value.__nunjucks_parent__ ?? varName ?? 'unknown';
	return resolveUndefined(options, {
		errorDef: ERROR_DEFINITIONS.NULL_VALUE,
		params: { accessPath, state: 'null', parent: parentName },
		subject: accessPath,
		warningName: 'NULL_VALUE',
		warningMessage: () => `Cannot access '${accessPath}' on null '${parentName}'`,
	});
};

export const resolveUndefinedValue = (options: ResolveUndefinedOptions): 'undefined' => {
	const { varName } = options;
	const errorDef: ErrorDefinitionEntry = varName
		? ERROR_DEFINITIONS.UNDEFINED_VARIABLE
		: ERROR_DEFINITIONS.UNDEFINED_VALUE;
	return resolveUndefined(options, {
		errorDef,
		params: { name: varName ?? '' },
		subject: varName,
		warningName: 'UNDEFINED_VARIABLE',
		warningMessage: () => varName
			? `Variable '${varName}' is undefined or null`
			: 'Variable is undefined or null',
	});
};
