const extractErrorText = (message) => {
  if (!message) return '';
  const errLine = message.split('\n').find((l) => /^ {2}Error:/i.test(l));
  if (errLine) return errLine.replace(/^ {2}Error:\s*/i, '');
  return message.split('\n').pop()?.trim() || message;
};

export const formatLocation = (errorData) => {
  const { templateName, line, col, includeChain, jsCaller } = errorData;

  const lineCol = line !== null ? `:${line}${col !== null ? `:${col}` : ''}` : '';
  
  let mainLoc = templateName + lineCol;
  
  if (jsCaller && templateName && !templateName.match(/\.(html|njk|j2|tmpl)$/i)) {
    const jsCol = col !== null ? `:${col}` : '';
    mainLoc = `${templateName}${jsCol}`;
  }

  if (includeChain && includeChain.length > 0) {
    const first = includeChain[0];
    const parentLoc = `${first.parentTmpl}:${first.parentLineno}${first.parentColno ? `:${first.parentColno}` : ''}`;
    return `${mainLoc} (included from ${parentLoc})`;
  }
  return mainLoc;
};

export const getDisplayMessage = (errorData) => {
  const { message, subject, classified } = errorData;
  const errorText = extractErrorText(message);

  if (!classified) return errorText;

  if (classified.category === 'undefined_variable') {
    return classified.undefinedName
      ? `Variable '${classified.undefinedName}' is undefined or null`
      : 'Variable is undefined or null';
  }

  if (classified.category === 'undefined_function') {
    return classified.undefinedName
      ? `Unable to call '${classified.undefinedName}', which is undefined or falsey`
      : 'Unable to call undefined function';
  }

  if (classified.category === 'not_a_function') {
    return classified.undefinedName
      ? `'${classified.undefinedName}' is not a function`
      : 'Value is not a function';
  }

  if (classified.category === 'circular_include') {
    const short = (subject || '').split(/[\\/]/).pop() || subject || 'template';
    return `Circular include detected: "${short}"`;
  }

  if (classified.category === 'syntax_error') {
    const clean = errorText.replace(/^parse[A-Z][a-zA-Z]*:\s*/i, '');
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  return errorText;
};

export const formatCodeTrace = (snippet) => {
  if (!snippet) return [];
  return snippet.split('\n').map(l => l.trim());
};
