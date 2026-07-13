export function optimize(code, options = {}) {
  if (options.async === false) {
    return optimizeSync(code);
  }
  return optimizeAsync(code);
}

function optimizeAsync(code) {
  let result = code;

  result = removeEmptyLines(result);
  result = simplifyStringConcat(result);
  result = optimizeVariableLookups(result);
  result = removeRedundantRuntime(result);

  return result;
}

function optimizeSync(code) {
  let result = code;

  result = removeAsyncKeywords(result);
  result = removeEmptyLines(result);
  result = simplifyStringConcat(result);
  result = optimizeVariableLookups(result);
  result = removeRedundantRuntime(result);

  return result;
}

function removeAsyncKeywords(code) {
  return code
    .replace(/async\s+function/g, 'function')
    .replace(/await\s+(?!env\.getFilter)/g, '');
}

function removeEmptyLines(code) {
  return code
    .split('\n')
    .filter(line => line.trim() !== '')
    .join('\n');
}

function simplifyStringConcat(code) {
  return code
    .replace(/output\.push\(\"\"\s*\+\s*/g, 'output.push(')
    .replace(/\s*\+\s*\"\"/g, '');
}

function optimizeVariableLookups(code) {
  // Disabled: This optimization was incorrect
  // The context object is a special object with its own lookup mechanism
  // Using context.name directly doesn't work the same as runtime.contextOrFrameLookup
  return code;
}

function removeRedundantRuntime(code) {
  return code
    .replace(/runtime\.escape\(runtime\.escape\(/g, 'runtime.escape(');
}

export function minify(code) {
  return code
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('; ');
}
