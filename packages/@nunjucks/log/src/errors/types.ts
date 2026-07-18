import type { LineBase } from '../shared/location.ts';

export type { LineBase };

export interface ErrorDefinitionEntry {
	name: string;
	message: (args?: Record<string, string> | string[]) => string;
	pattern: RegExp;
}

export interface ErrorInfo {
	code?: string | null;
	subject?: string | null;
	phase?: string | null;
	templateName?: string | null;
	renderContext?: Record<string, unknown>;
	lineBase?: LineBase | null;
}

export interface WarningInfo extends ErrorInfo {
	varName?: string | null;
	undefinedMode?: string;
}

export interface OutputOptions {
	format?: 'html' | 'ansi' | 'text';
	verbosity?: 'simple' | 'medium' | 'full';
	dev?: boolean;
	ide?: string;
	isProduction?: boolean;
	templatePath?: string;
	renderContext?: Record<string, unknown>;
	version?: string;
	timestamp?: string;
	sourceContent?: string;
	sourceStartLine?: number;
	snippet?: string;
	csp?: { nonce?: string };
	jsCaller?: string;
	jsCallerErrorLine?: number;
	isJsCaller?: boolean;
}

export interface TemplateError extends Error {
	name: 'Template render error';
	lineno: number | null;
	colno: number | null;
	code: string | null;
	subject: string | null;
	phase: string | null;
	templateName: string | null;
	renderContext?: Record<string, unknown>;
	lineBase?: LineBase | null;
	outputOptions?: Omit<OutputOptions, 'format'>;
	output: (options?: OutputOptions) => {
		html: string;
		ansi: string;
		text: string;
	} | string;
}

export interface TemplateWarning {
	message: string;
	lineno: number | null;
	colno: number | null;
	varName: string | null;
	templateName: string | null;
	undefinedMode: string;
	code: string | null;
	subject: string | null;
	phase: string | null;
	lineBase?: LineBase | null;
	output: (options?: Omit<OutputOptions, 'format' | 'isProduction'>) => string;
}

export interface ErrorContext {
	lineno?: number | null;
	colno?: number | null;
	phase?: string | null;
	templateName?: string | null;
	templatePath?: string | null;
	lineBase?: LineBase | null;
}

export interface WarningContext extends ErrorContext {
	varName?: string | null;
	undefinedMode?: string | null;
}

export interface ClassifiedError {
	category: string;
	message: string;
	undefinedName: string | null;
	title: string | null;
	causes: string[];
	fixCode: string | null;
	fixComment: string | null;
	lineno: number | null;
	colno: number | null;
	rawMessage: string;
}

export interface ClassifyInput {
	message?: string;
	lineno?: number | null;
	colno?: number | null;
	code?: string;
	subject?: string;
	phase?: string;
	templateName?: string;
	stack?: string;
}

export type SubjectExtractor = (groups: RegExpMatchArray) => string | null;

export interface ClassificationRule {
	pattern: RegExp;
	category: string;
	subjectFrom: SubjectExtractor | null;
	titleTemplate?: string;
	causes: string[];
	fixCode?: string;
	fixComment?: string;
	sourceFromStack?: boolean;
}

export interface Classification {
	category: string;
	undefinedName: string | null;
	causes: string[];
	fixCode: string | null;
	fixComment: string | null;
	title?: string | null;
}

export const DEFAULT_CLASSIFICATION: Classification = {
	category: 'unknown',
	undefinedName: null,
	causes: [
		'Check template **syntax**',
		'Verify **variable scope**',
		'Check **render context** data'
	],
	fixCode: 'Inspect the error message above for clues',
	fixComment: 'Review the template source and context'
};
