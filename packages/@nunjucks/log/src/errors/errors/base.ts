export interface NunjucksErrorMetadata {
  code?: string;
  phase?: string;
  templatePath?: string | null;
  templateName?: string | null;
  line?: number | null;
  col?: number | null;
  sourceContent?: string | null;
  cause?: unknown;
}

export class NunjucksError extends Error {
  readonly code: string | undefined;
  readonly phase: string | undefined;
  readonly templatePath: string | null | undefined;
  readonly templateName: string | null | undefined;
  readonly line: number | null | undefined;
  readonly col: number | null | undefined;
  readonly sourceContent: string | null | undefined;

  constructor(message: string, metadata: NunjucksErrorMetadata = {}) {
    super(message);
    this.name = 'NunjucksError';
    this.code = metadata.code;
    this.phase = metadata.phase;
    this.templatePath = metadata.templatePath;
    this.templateName = metadata.templateName;
    this.line = metadata.line ?? null;
    this.col = metadata.col ?? null;
    this.sourceContent = metadata.sourceContent ?? null;
    if (metadata.cause) {
      this.cause = metadata.cause;
    }
  }
}

export function isNunjucksError(value: unknown): value is NunjucksError {
  return value instanceof Error && 'code' in value;
}
