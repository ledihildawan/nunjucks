#!/usr/bin/env node

import { precompileString } from '../../src/precompile/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const viewsDir = path.join(__dirname, 'views');
const jsDir = path.join(__dirname, 'js');

if (!fs.existsSync(jsDir)) {
  fs.mkdirSync(jsDir, { recursive: true });
}

const templates = ['base', 'about', 'index', 'home', 'error-undefined-variable'];

const precompiledTemplates = {};

for (const name of templates) {
  const templatePath = path.join(viewsDir, `${name}.html`);
  if (fs.existsSync(templatePath)) {
    const source = fs.readFileSync(templatePath, 'utf-8');
    try {
      precompiledTemplates[name] = precompileString(source, {
        name: `${name}.html`,
        asFunction: false
      });
    } catch (e) {
      console.warn(`Warning: Could not compile ${name}.html: ${e.message}`);
    }
  }
}

const errorHandlingCode = `
// Error handling for precompiled Nunjucks templates
(function() {
  var ERROR_PATTERNS = {
    UNDEFINED_VALUE: /attempted to output '([^']+\\.[^']+)' null or undefined value/i,
    UNDEFINED_VARIABLE: /attempted to output '([^.]+)' null or undefined value/i,
    NOT_A_FUNCTION: /is not a function|is not defined/i,
    SYNTAX_ERROR: /unexpected token|expected (?:comma|variable end|end|expression)/i,
    FILTER_ERROR: /^Error: (.+)/
  };

  var ERROR_RULES = {
    undefined_value: {
      causes: ['Nested property access returned null/undefined', 'Array index out of bounds', 'Object property does not exist'],
      fix: "Use default filter: {{ object.property | default('default_value') }}"
    },
    undefined_variable: {
      causes: ['Variable not passed in render context', 'Typo in variable name'],
      fix: "Add default filter or pass variable in context"
    },
    not_a_function: {
      causes: ['Calling a non-function value', 'Variable contains wrong data type'],
      fix: "Check variable type before calling"
    },
    syntax_error: {
      causes: ['Missing closing tag', 'Mismatched quotes or brackets', 'Unclosed array/object brackets'],
      fix: "Check brackets, quotes, and tag closures"
    },
    filter_error: {
      causes: ['Filter threw an error during execution', 'Filter should handle null/undefined inputs'],
      fix: "Check filter input validation"
    }
  };

  function classifyError(message) {
    for (var key in ERROR_PATTERNS) {
      if (ERROR_PATTERNS[key].test(message)) {
        var category = key.replace(/_([a-z])/g, function(m, c) { return '_' + c; }).toLowerCase();
        return ERROR_RULES[category] || { causes: ['Unknown error'], fix: 'Check error message' };
      }
    }
    return { causes: ['Check template syntax', 'Verify variable scope'], fix: 'Review error details' };
  }

  function renderErrorHtml(error, templateName, lineno) {
    var msg = error.message || error.toString();
    var classified = classifyError(msg);
    var causesHtml = '';
    for (var i = 0; i < classified.causes.length; i++) {
      causesHtml += '<li>' + classified.causes[i] + '</li>';
    }
    
    return '<div style="font-family: system-ui, sans-serif; padding: 1rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.5rem; color: #991b1b; max-width: 600px; margin: 1rem 0;">' +
      '<div style="font-weight: 600; font-size: 1rem; margin-bottom: 0.5rem;">Template Error: ' + templateName + '</div>' +
      '<div style="font-size: 0.875rem; font-family: monospace; word-break: break-all;">' + escapeHtml(msg) + '</div>' +
      '<div style="font-size: 0.75rem; color: #dc2626; margin-top: 0.5rem;">Line: ' + lineno + '</div>' +
      '<div style="margin-top: 0.5rem; font-size: 0.75rem; color: #7f1d1d;"><strong>Possible Causes:</strong><ul>' + causesHtml + '</ul></div>' +
      '<div style="margin-top: 0.5rem; font-size: 0.75rem; color: #7f1d1d;"><strong>Suggested Fix:</strong><pre style="background: #fee2e2; padding: 0.5rem; border-radius: 0.25rem; overflow-x: auto; margin: 0.5rem 0 0 0;">' + escapeHtml(classified.fix) + '</pre></div>' +
    '</div>';
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.__nunjucksError = {
    classifyError: classifyError,
    renderErrorHtml: renderErrorHtml
  };
})();
`;

const runtimeCode = `
// Minimal nunjucks runtime for precompiled templates
(function() {
  window.nunjucksRuntime = {
    suppressValue: function(val, autoescape) {
      return val == null ? '' : String(val);
    },
    contextOrFrameLookup: function(context, frame, name) {
      var val = context.get(name);
      if (val !== undefined) return val;
      return undefined;
    },
    memberLookup: function(obj, val) {
      return obj ? obj[val] : undefined;
    },
    safeString: function(val) { return String(val); },
    coerce: function(val) { return val; },
    awaitValue: function(val) { return val; },
    handleError: function(e, lineno, colno) { throw e; },
    copySafeString: function(obj) { return String(obj); },
    undefined: undefined,
    SafeString: function(val) { return String(val); }
  };
})();
`;

const helperCode = `
// Render helper function
window.renderTemplate = function(name, context) {
  var tmpl = window.nunjucksPrecompiled && window.nunjucksPrecompiled[name + ".html"];
  if (!tmpl) {
    return '<div style="color: red; padding: 1rem;">Template not found: ' + name + '</div>';
  }
  var env = { 
    opts: { autoescape: true }, 
    getTemplate: function() { return null; } 
  };
  var runtime = window.nunjucksRuntime;
  var ctx = {
    get: function(k) { 
      return (context || {})[k]; 
    },
    getBlock: function() { return null; }
  };
  try {
    var result = tmpl.root(env, ctx, null, runtime);
    if (result && result.then) {
      return result.then(function(r) { return r; }).catch(function(e) {
        return window.__nunjucksError.renderErrorHtml(e, name + '.html', 0);
      });
    }
    return result;
  } catch(e) {
    return window.__nunjucksError.renderErrorHtml(e, name + '.html', 0);
  }
};
`;

const finalOut = Object.keys(precompiledTemplates).reduce((acc, name) => {
  return acc + precompiledTemplates[name] + '\n';
}, '// Nunjucks precompiled templates with error handling\n' + errorHandlingCode + '\n' + runtimeCode + '\n') + helperCode;

fs.writeFileSync(path.join(jsDir, 'templates.js'), finalOut, 'utf-8');

console.log('Precompiled templates with error handling:');
Object.keys(precompiledTemplates).forEach(t => console.log('  - ' + t + '.html'));

console.log('\nDone! Files created in ' + jsDir);

const browserPath = path.join(__dirname, '../../browser/nunjucks.js');
if (fs.existsSync(browserPath)) {
  fs.writeFileSync(
    path.join(jsDir, 'nunjucks.js'),
    fs.readFileSync(browserPath, 'utf-8'),
    'utf-8'
  );
  console.log('Copied nunjucks.js to ' + jsDir);
} else {
  console.log('Note: browser/nunjucks.js not found - using minimal runtime');
}
