type SubjectExtractor = (groups: RegExpMatchArray) => string | null;
type ExtraExtractor = (groups: RegExpMatchArray) => Record<string, string> | null;

const firstCapture: SubjectExtractor = (groups) => groups[1] ?? null;

interface ErrorDefinitionOptions {
  name: string;
  message: string;
  category: string;
  causes: string[];
  fixCode?: string;
  fixComment?: string;
  documentationUrl?: string;
  severity?: 'error' | 'warning' | 'info';
  extraFrom?: ExtraExtractor;
}

const createPattern = (messageTemplate: string): RegExp => {
  const pattern = messageTemplate
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\{type\\}/g, '(.+)')
    .replace(/\\{name\\}/g, '([^"]+)')
    .replace(/\\{key\\}/g, '([^"]+)')
    .replace(/\\{keys\\}/g, '(.+)')
    .replace(/\\{values\\}/g, '(.+)')
    .replace(/\\{violations\\}/g, '(.+)')
    .replace(/\\{subject\\}/g, '([^"]+)')
    .replace(/\\{attr\\}/g, '([^"]+)')
    .replace(/\\{by\\}/g, '(.+)');
  return new RegExp(`^${pattern}$`, 'i');
};

const createErrorDefinition = (options: ErrorDefinitionOptions) => {
  const { name, message, category, causes, fixCode, fixComment, documentationUrl, severity, extraFrom } = options;
  const hasVariable = message.includes('{type}') || message.includes('{name}') || message.includes('{key}') || message.includes('{keys}') || message.includes('{values}') || message.includes('{violations}') || message.includes('{subject}') || message.includes('{attr}') || message.includes('{by}');

  let subjectFrom: SubjectExtractor | null = null;
  if (hasVariable) {
    subjectFrom = firstCapture;
  }

  return {
    name,
    message,
    pattern: createPattern(message),
    category,
    titleTemplate: message,
    causes,
    fixCode,
    fixComment,
    documentationUrl,
    severity,
    subjectFrom,
    extraFrom: extraFrom ?? null
  };
};

const ERROR_TEMPLATES = {
  ARRAY_EXPECTED: (filterName: string) => createErrorDefinition({
    name: `${filterName.toUpperCase()}_FILTER`,
    message: `${filterName}: expected array, got {type}`,
    category: 'array_error',
    causes: [
      `The \`${filterName}\` filter requires an **array** input`,
      'A string, number, or null was passed instead of an array',
      'The variable might not be an array in the render context'
    ],
    fixCode: `{{ items |> ${filterName} }}`,
    fixComment: `Ensure the value passed to ${filterName} is an array`
  }),

  NUMBER_EXPECTED: (filterName: string) => createErrorDefinition({
    name: `${filterName.toUpperCase()}_FILTER`,
    message: `${filterName}: expected number, got {type}`,
    category: 'math_error',
    causes: [
      `The \`${filterName}\` filter requires a **number** input`,
      'A string, array, or null was passed instead of a number',
      'The variable might not be a number in the render context'
    ],
    fixCode: `{{ value |> ${filterName} }}`,
    fixComment: `Ensure the value passed to ${filterName} is a number`
  }),

  STRING_EXPECTED: (filterName: string) => createErrorDefinition({
    name: `${filterName.toUpperCase()}_FILTER`,
    message: `${filterName}: expected string, got {type}`,
    category: 'string_error',
    causes: [
      `The \`${filterName}\` filter requires a **string** input`,
      'A number, array, or null was passed instead of a string',
      'The variable might not be a string in the render context'
    ],
    fixCode: `{{ value |> ${filterName} }}`,
    fixComment: `Ensure the value passed to ${filterName} is a string`
  }),

  OBJECT_EXPECTED: (filterName: string) => createErrorDefinition({
    name: `${filterName.toUpperCase()}_FILTER`,
    message: `${filterName}: expected object, got {type}`,
    category: 'object_error',
    causes: [
      `The \`${filterName}\` filter requires an **object** input`,
      'An array, string, or primitive was passed instead of an object',
      'The variable might not be an object in the render context'
    ],
    fixCode: `{{ data |> ${filterName} }}`,
    fixComment: `Ensure the value passed to ${filterName} is an object`
  }),

  ATTRIBUTE_MISSING: (filterName: string) => createErrorDefinition({
    name: `${filterName.toUpperCase()}_ATTR`,
    message: `${filterName}: attribute '{attr}' does not exist`,
    category: 'attribute_error',
    causes: [
      `The \`${filterName}\` filter requires the attribute to exist on items`,
      'Some items do not have the requested attribute',
      'The attribute name is misspelled'
    ],
    fixCode: `{{ items |> ${filterName}("existingAttr") }}`,
    fixComment: 'Use an attribute that exists on all items'
  }),

  INVALID_VALUE: (filterName: string, validValues: string[]) => createErrorDefinition({
    name: `${filterName.toUpperCase()}_INVALID`,
    message: `${filterName}: invalid value '{attr}'. Must be one of: ${validValues.join(', ')}`,
    category: 'value_error',
    causes: [
      `The \`${filterName}\` filter received an invalid value`,
      `Valid values are: ${validValues.join(', ')}`,
      'A typo or incorrect value was passed'
    ],
    fixCode: `{{ value |> ${filterName}("${validValues[0]}") }}`,
    fixComment: `Use one of the valid values: ${validValues.join(', ')}`
  })
} as const;

export { createErrorDefinition, ERROR_TEMPLATES };
export type { ErrorDefinitionOptions };
