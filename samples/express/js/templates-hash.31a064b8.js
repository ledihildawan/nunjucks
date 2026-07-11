(function(global) {\n
(function(global) {
  "use strict";
  var nunjucksRuntime = {
    suppressValue: function(val, autoescape) {
      if (val && typeof val.then === "function") {
        return val.then(function(v) { return nunjucksRuntime.suppressValue(v, autoescape); });
      }
      val = (val !== undefined && val !== null) ? val : "";
      if (autoescape && typeof val === "string") {
        val = val.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\\/g, "&#92;");
      }
      return val;
    },
    awaitValue: function(val) {
      if (val && typeof val.then === "function") {
        return val.then(function(v) { return v; });
      }
      return val;
    },
    contextOrFrameLookup: function(context, frame, name) {
      var val = frame && frame.lookup(name);
      return (val !== undefined) ? val : context.lookup(name);
    },
    memberLookup: function(obj, prop) {
      if (obj == null) return undefined;
      return obj[prop];
    },
    optionalMemberLookup: function(obj, prop) {
      if (obj == null) return [undefined, true];
      var val = obj[prop];
      return [val, val === undefined];
    },
    slice: function(obj, start, end) {
      if (typeof obj === "string") return obj.slice(start, end);
      if (Array.isArray(obj)) return obj.slice(start, end);
      return null;
    },
    nullishCoalesce: function(obj, prop, defaultValue) {
      var val = obj[prop];
      return val !== undefined && val !== null ? val : defaultValue;
    },
    inOperator: function(key, val) {
      if (Array.isArray(val) || typeof val === "string") return val.indexOf(key) !== -1;
      if (val && typeof val === "object") return key in val;
      return false;
    },
    fromIterator: function(arr) {
      if (typeof arr !== "object" || arr === null || Array.isArray(arr)) return arr;
      if (Symbol.iterator in arr) return Array.from(arr);
      return arr;
    },
    isArray: Array.isArray,
    keys: function(obj) {
      if (!obj || typeof obj !== "object") return [];
      return Object.keys(obj);
    },
    SafeString: function(val) { return String(val); },
    isSafeString: function() { return false; },
    copySafeness: function(dest, src) { return src; },
    markSafe: function(val) { return String(val); },
    handleError: function(error, lineno, colno) {
      if (error.lineno !== undefined) return error;
      var err = new Error(error.message);
      err.lineno = lineno;
      err.colno = colno;
      return err;
    },
    callWrap: function(obj, name, context, args, lineno, colno) {
      if (!obj) {
        var err = new Error("Unable to call \`" + name + "\`, which is undefined or falsey");
        err.lineno = lineno;
        err.colno = colno;
        throw err;
      } else if (typeof obj !== "function") {
        var err = new Error("Unable to call \`" + name + "\`, which is not a function");
        err.lineno = lineno;
        err.colno = colno;
        throw err;
      }
      return obj.apply(context, args);
    },
    isObject: function(val) {
      return val !== null && typeof val === "object" && !Array.isArray(val);
    },
    safeString: function(val) { return String(val); },
    copySafeString: function(obj) { return String(obj); },
    coerce: function(val) { return val; },
    undefinedValue: function() { return undefined; },
    frameLookup: function(ctx, frame, name) {
      var val = frame && frame.lookup(name);
      if (val !== undefined) return val;
      return ctx.get(name);
    },
    merge: function(src, dest) {
      for (var key in src) {
        if (Object.prototype.hasOwnProperty.call(src, key)) {
          dest[key] = src[key];
        }
      }
      return dest;
    }
  };
  global.nunjucksRuntime = nunjucksRuntime;
})(typeof window !== "undefined" ? window : global);

(function() {
  var ERROR_PATTERNS = {
    UNDEFINED_VALUE: /attempted to output '([^']+\\.[^']+)' null or undefined value/i,
    UNDEFINED_VARIABLE: /attempted to output '([^.]+)' null or undefined value/i,
    NOT_A_FUNCTION: /is not a function|is not defined/i,
    SYNTAX_ERROR: /unexpected token|expected (?:comma|variable end|end|expression)/i,
    FILTER_ERROR: /^Error: (.+)/,
    SANDBOX_BLOCKED: /cannot access|cannot read|permission denied/i,
    SLICE_ERROR: /slice/i,
    ITERABLE_ERROR: /iterator|iterable/i,
    OPERATOR_ERROR: /operator|operand/i
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
    },
    sandbox_blocked: {
      causes: ['Accessing blocked properties in sandbox mode', 'Attempting to access prototype properties'],
      fix: "Use safe property access or disable sandbox restrictions"
    },
    slice_error: {
      causes: ['Invalid slice parameters', 'Step value cannot be zero'],
      fix: "Ensure slice start/end/step are valid"
    },
    iterable_error: {
      causes: ['Object is not iterable', 'Missing iterator'],
      fix: "Use array or object with proper iterator"
    },
    operator_error: {
      causes: ['Invalid operator usage', 'Type mismatch'],
      fix: "Check operand types"
    }
  };

  function classifyError(message) {
    for (var key in ERROR_PATTERNS) {
      if (ERROR_PATTERNS[key].test(message)) {
        var category = key.toLowerCase().replace(/_([a-z])/g, function(m, c) { return c; });
        return ERROR_RULES[category] || { causes: ['Unknown error'], fix: 'Check error message' };
      }
    }
    return { causes: ['Check template syntax', 'Verify variable scope'], fix: 'Review error details' };
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderErrorHtml(error, templateName, lineno) {
    var msg = error.message || error.toString();
    var classified = classifyError(msg);
    var causesHtml = '';
    for (var i = 0; i < classified.causes.length; i++) {
      causesHtml += '<li>' + classified.causes[i] + '</li>';
    }
    
    return '<div style="font-family: system-ui, sans-serif; padding: 1rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.5rem; color: #991b1b; max-width: 600px; margin: 1rem 0;">' +
      '<div style="font-weight: 600; font-size: 1rem; margin-bottom: 0.5rem;">Template Error: ' + escapeHtml(templateName) + '</div>' +
      '<div style="font-size: 0.875rem; font-family: monospace; word-break: break-all;">' + escapeHtml(msg) + '</div>' +
      '<div style="font-size: 0.75rem; color: #dc2626; margin-top: 0.5rem;">Line: ' + lineno + '</div>' +
      '<div style="margin-top: 0.5rem; font-size: 0.75rem; color: #7f1d1d;"><strong>Possible Causes:</strong><ul>' + causesHtml + '</ul></div>' +
      '<div style="margin-top: 0.5rem; font-size: 0.75rem; color: #7f1d1d;"><strong>Suggested Fix:</strong><pre style="background: #fee2e2; padding: 0.5rem; border-radius: 0.25rem; overflow-x: auto; margin: 0.5rem 0 0 0;">' + escapeHtml(classified.fix) + '</pre></div>' +
    '</div>';
  }

  window.__nunjucksError = {
    classifyError: classifyError,
    renderErrorHtml: renderErrorHtml
  };
})();
(function() {\n  window.nunjucksPrecompiled = window.nunjucksPrecompiled || {};\n  window.nunjucksPrecompiled["views/about.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
lineno = 0; colno = 3;
var t_2 = await env.getTemplate("base.html", true, "views/about.html", false);
parentTemplate = t_2
var __parentBlockNames = Object.keys(parentTemplate.blocks);
context.setParentBlockNames(__parentBlockNames);
for(var t_1 in parentTemplate.blocks) {
context.addBlock(t_1, parentTemplate.blocks[t_1]);
}
context.validateBlocks();
childOutput += "\n\n";
if(!parentTemplate) {
var t_3 = await (await context.getBlock("content"))(env, context, frame, runtime);
childOutput += t_3;
}
childOutput += "\n\n";
if(!parentTemplate) {
var t_4 = await (await context.getBlock("footer"))(env, context, frame, runtime);
childOutput += t_4;
}
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
async function b_content(env, context, frame, runtime) {
var lineno = 2;
var colno = 3;
var output = "";
try {
var frame = frame.push(true);
output += "\nThis is just the about page\n";
return output;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
async function b_footer(env, context, frame, runtime) {
var lineno = 6;
var colno = 3;
var output = "";
try {
var frame = frame.push(true);
hole_0 = await context.getSuper(env, "footer", b_footer, frame, runtime);
hole_0 = runtime.markSafe(hole_0);
output += "\n";
lineno = 7; colno = 8; output += runtime.suppressValue(
await runtime.awaitValue(hole_0), env.opts.autoescape);
output += "\nYou really should read this!\n\n";
lineno = 10; colno = 3; output += runtime.suppressValue(
await runtime.awaitValue(runtime.contextOrFrameLookup(context, frame, "poop")), env.opts.autoescape);
output += "\n";
return output;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
b_content: b_content,
b_footer: b_footer,
root: root
};


  })();
  window.nunjucksPrecompiled["views/base.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
childOutput += "<!DOCTYPE html>\n<html>\n<head><title>Base Template</title></head>\n<body>\n  <h1>Base Template</h1>\n  ";
if(!parentTemplate) {
var t_1 = await (await context.getBlock("content"))(env, context, frame, runtime);
childOutput += t_1;
}
childOutput += "\n</body>\n</html>";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
async function b_content(env, context, frame, runtime) {
var lineno = 5;
var colno = 5;
var output = "";
try {
var frame = frame.push(true);
return output;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
b_content: b_content,
root: root
};


  })();
  window.nunjucksPrecompiled["views/error-base.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
childOutput += "<!DOCTYPE html>\n<html>\n<head>\n  <title>Error Base</title>\n</head>\n<body>\n  <h1>Error in Base Template</h1>\n  <p>";
lineno = 7; colno = 24; childOutput += runtime.suppressValue(
await runtime.awaitValue((lineno = 7, colno = 24, runtime.callWrap(runtime.contextOrFrameLookup(context, frame, "missing_function"), "missing_function", "missing_function()", context, [], 7, 24))), env.opts.autoescape);
childOutput += "</p>\n  ";
if(!parentTemplate) {
var t_1 = await (await context.getBlock("content"))(env, context, frame, runtime);
childOutput += t_1;
}
childOutput += "\n</body>\n</html>\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
async function b_content(env, context, frame, runtime) {
var lineno = 8;
var colno = 5;
var output = "";
try {
var frame = frame.push(true);
return output;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
b_content: b_content,
root: root
};


  })();
  window.nunjucksPrecompiled["views/error-child.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
lineno = 0; colno = 3;
var t_2 = await env.getTemplate("error-base.html", true, "views/error-child.html", false);
parentTemplate = t_2
var __parentBlockNames = Object.keys(parentTemplate.blocks);
context.setParentBlockNames(__parentBlockNames);
for(var t_1 in parentTemplate.blocks) {
context.addBlock(t_1, parentTemplate.blocks[t_1]);
}
context.validateBlocks();
childOutput += "\n\n";
if(!parentTemplate) {
var t_3 = await (await context.getBlock("content"))(env, context, frame, runtime);
childOutput += t_3;
}
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
async function b_content(env, context, frame, runtime) {
var lineno = 2;
var colno = 3;
var output = "";
try {
var frame = frame.push(true);
output += "\n<p>This content will not be shown because the parent has an error.</p>\n";
return output;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
b_content: b_content,
root: root
};


  })();
  window.nunjucksPrecompiled["views/error-circular-include.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
lineno = 0; colno = 3;
var t_1 = await env.getTemplate("error-circular-include.html", false, {parentTmpl: "views/error-circular-include.html", parentLineno: 1, parentColno: 4}, false);
var t_2 = await t_1.render(context.getVariables(), frame);childOutput += t_2;
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
root: root
};


  })();
  window.nunjucksPrecompiled["views/error-file-not-found.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
lineno = 0; colno = 3;
var t_1 = await env.getTemplate("nonexistent-template.html", false, {parentTmpl: "views/error-file-not-found.html", parentLineno: 1, parentColno: 4}, false);
var t_2 = await t_1.render(context.getVariables(), frame);childOutput += t_2;
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
root: root
};


  })();
  window.nunjucksPrecompiled["views/error-filesystem-error.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
lineno = 0; colno = 3;
var t_1 = await env.getTemplate("/nonexistent/path/template.html", false, {parentTmpl: "views/error-filesystem-error.html", parentLineno: 1, parentColno: 4}, false);
var t_2 = await t_1.render(context.getVariables(), frame);childOutput += t_2;
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
root: root
};


  })();
  window.nunjucksPrecompiled["views/error-filter-error.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
lineno = 0; colno = 13; childOutput += runtime.suppressValue(
await runtime.awaitValue(env.getFilter("failingAsync").call(context, "test")), env.opts.autoescape);
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
root: root
};


  })();
  window.nunjucksPrecompiled["views/error-include.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
lineno = 0; colno = 3;
var t_2 = await env.getTemplate("base.html", true, "views/error-include.html", false);
parentTemplate = t_2
var __parentBlockNames = Object.keys(parentTemplate.blocks);
context.setParentBlockNames(__parentBlockNames);
for(var t_1 in parentTemplate.blocks) {
context.addBlock(t_1, parentTemplate.blocks[t_1]);
}
context.validateBlocks();
childOutput += "\n\n";
if(!parentTemplate) {
var t_3 = await (await context.getBlock("content"))(env, context, frame, runtime);
childOutput += t_3;
}
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
async function b_content(env, context, frame, runtime) {
var lineno = 2;
var colno = 3;
var output = "";
try {
var frame = frame.push(true);
output += "\n<h2>Error Demo - Include</h2>\n<p>This page includes a partial that will throw an error:</p>\n\n";
lineno = 6; colno = 3;
var t_4 = await env.getTemplate("error-partial.html", false, {parentTmpl: "views/error-include.html", parentLineno: 7, parentColno: 4}, false);
var t_5 = await t_4.render(context.getVariables(), frame);output += t_5;
output += "\n\n";
return output;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
b_content: b_content,
root: root
};


  })();
  window.nunjucksPrecompiled["views/error-invalid-include.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
var t_1;
t_1 = 123;
frame.set("templateName", t_1, true);
if(frame.topLevel) {
context.setVariable("templateName", t_1);
}
if(frame.topLevel) {
context.addExport("templateName", t_1);
}
childOutput += "\n";
lineno = 1; colno = 3;
var t_2 = await env.getTemplate(runtime.contextOrFrameLookup(context, frame, "templateName"), false, {parentTmpl: "views/error-invalid-include.html", parentLineno: 2, parentColno: 4}, false);
var t_3 = await t_2.render(context.getVariables(), frame);childOutput += t_3;
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
root: root
};


  })();
  window.nunjucksPrecompiled["views/error-no-super-block.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
if(!parentTemplate) {
var t_1 = await (await context.getBlock("content"))(env, context, frame, runtime);
childOutput += t_1;
}
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
async function b_content(env, context, frame, runtime) {
var lineno = 0;
var colno = 3;
var output = "";
try {
var frame = frame.push(true);
hole_0 = await context.getSuper(env, "content", b_content, frame, runtime);
hole_0 = runtime.markSafe(hole_0);
lineno = 0; colno = 27; output += runtime.suppressValue(
await runtime.awaitValue(hole_0), env.opts.autoescape);
return output;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
b_content: b_content,
root: root
};


  })();
  window.nunjucksPrecompiled["views/error-not-a-function.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
childOutput += "Hello ";
lineno = 0; colno = 13; childOutput += runtime.suppressValue(
await runtime.awaitValue(runtime.memberLookup((runtime.contextOrFrameLookup(context, frame, "user")),"name")), env.opts.autoescape);
childOutput += "!\nYour status: ";
lineno = 1; colno = 30; childOutput += runtime.suppressValue(
await runtime.awaitValue((lineno = 1, colno = 30, runtime.callWrap(runtime.memberLookup((runtime.contextOrFrameLookup(context, frame, "user")),"status"), "user[\"status\"]", "user[\"status\"]()", context, [], 1, 30))), env.opts.autoescape);
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
root: root
};


  })();
  window.nunjucksPrecompiled["views/error-partial.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
lineno = 0; colno = 21; childOutput += runtime.suppressValue(
await runtime.awaitValue((lineno = 0, colno = 21, runtime.callWrap(runtime.contextOrFrameLookup(context, frame, "undefined_function"), "undefined_function", "undefined_function()", context, [], 0, 21))), env.opts.autoescape);
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
root: root
};


  })();
  window.nunjucksPrecompiled["views/error-undefined-block.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
lineno = 0; colno = 3;
var t_2 = await env.getTemplate("base.html", true, "views/error-undefined-block.html", false);
parentTemplate = t_2
var __parentBlockNames = Object.keys(parentTemplate.blocks);
context.setParentBlockNames(__parentBlockNames);
for(var t_1 in parentTemplate.blocks) {
context.addBlock(t_1, parentTemplate.blocks[t_1]);
}
context.validateBlocks();
childOutput += "\n";
if(!parentTemplate) {
var t_3 = await (await context.getBlock("nonexistent"))(env, context, frame, runtime);
childOutput += t_3;
}
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
async function b_nonexistent(env, context, frame, runtime) {
var lineno = 1;
var colno = 3;
var output = "";
try {
var frame = frame.push(true);
output += "\n  <p>This block doesn't exist in parent</p>\n";
return output;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
b_nonexistent: b_nonexistent,
root: root
};


  })();
  window.nunjucksPrecompiled["views/error-undefined-filter.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
childOutput += "Name: ";
lineno = 0; colno = 23; childOutput += runtime.suppressValue(
await runtime.awaitValue(env.getFilter("capitalize").call(context, "john doe")), env.opts.autoescape);
childOutput += "\nEmail: ";
lineno = 1; colno = 24; childOutput += runtime.suppressValue(
await runtime.awaitValue(env.getFilter("maskEmail").call(context, runtime.memberLookup((runtime.contextOrFrameLookup(context, frame, "user")),"email"))), env.opts.autoescape);
childOutput += "\nPhone: ";
lineno = 2; colno = 25; childOutput += runtime.suppressValue(
await runtime.awaitValue(env.getFilter("formatPhone").call(context, runtime.contextOrFrameLookup(context, frame, "phoneNumber"))), env.opts.autoescape);
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
root: root
};


  })();
  window.nunjucksPrecompiled["views/error-undefined-function.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
childOutput += "User: ";
lineno = 0; colno = 25; childOutput += runtime.suppressValue(
await runtime.awaitValue(runtime.memberLookup(((lineno = 0, colno = 23, runtime.callWrap(runtime.contextOrFrameLookup(context, frame, "getCurrentUser"), "getCurrentUser", "getCurrentUser()", context, [], 0, 23))),"username")), env.opts.autoescape);
childOutput += "\nRole: ";
lineno = 1; colno = 20; childOutput += runtime.suppressValue(
await runtime.awaitValue((lineno = 1, colno = 20, runtime.callWrap(runtime.contextOrFrameLookup(context, frame, "getUserRole"), "getUserRole", "getUserRole()", context, [runtime.memberLookup((runtime.contextOrFrameLookup(context, frame, "user")),"id")], 1, 20))), env.opts.autoescape);
childOutput += "\nLast login: ";
lineno = 2; colno = 25; childOutput += runtime.suppressValue(
await runtime.awaitValue((lineno = 2, colno = 25, runtime.callWrap(runtime.contextOrFrameLookup(context, frame, "formatDate"), "formatDate", "formatDate()", context, [runtime.contextOrFrameLookup(context, frame, "timestamp")], 2, 25))), env.opts.autoescape);
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
root: root
};


  })();
  window.nunjucksPrecompiled["views/error-undefined-value.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
childOutput += "Product name: ";
lineno = 0; colno = 24; childOutput += runtime.suppressValue(
await runtime.awaitValue(runtime.memberLookup((runtime.contextOrFrameLookup(context, frame, "product")),"name")), env.opts.autoescape);
childOutput += "\nProduct price: ";
lineno = 1; colno = 25; childOutput += runtime.suppressValue(
await runtime.awaitValue(runtime.memberLookup((runtime.contextOrFrameLookup(context, frame, "product")),"price")), env.opts.autoescape);
childOutput += "\nDiscount: ";
lineno = 2; colno = 29; childOutput += runtime.suppressValue(
await runtime.awaitValue(runtime.memberLookup((runtime.memberLookup((runtime.contextOrFrameLookup(context, frame, "product")),"discount")),"percentage")), env.opts.autoescape);
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
root: root
};


  })();
  window.nunjucksPrecompiled["views/error-undefined-variable.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
childOutput += "Hello ";
lineno = 0; colno = 9; childOutput += runtime.suppressValue(
await runtime.awaitValue(runtime.contextOrFrameLookup(context, frame, "user_name")), env.opts.autoescape);
childOutput += ", welcome to ";
lineno = 0; colno = 37; childOutput += runtime.suppressValue(
await runtime.awaitValue(runtime.contextOrFrameLookup(context, frame, "app_name")), env.opts.autoescape);
childOutput += "!\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
root: root
};


  })();
  window.nunjucksPrecompiled["views/home.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
childOutput += "<!DOCTYPE html>\n<html>\n<head><title>Home</title></head>\n<body>\n  <h1>Welcome, ";
lineno = 4; colno = 18; childOutput += runtime.suppressValue(
await runtime.awaitValue(runtime.contextOrFrameLookup(context, frame, "username")), env.opts.autoescape);
childOutput += "!</h1>\n  <h2>Items:</h2>\n  <ul>\n    ";
frame = frame.push();
var t_3 = runtime.contextOrFrameLookup(context, frame, "items");
if(t_3) {t_3 = runtime.fromIterator(t_3);
var t_2 = t_3.length;
for(var t_1=0; t_1 < t_3.length; t_1++) {
var t_4 = t_3[t_1];
frame.set("item", t_4);
frame.set("loop.index", t_1 + 1);
frame.set("loop.index0", t_1);
frame.set("loop.revindex", t_2 - t_1);
frame.set("loop.revindex0", t_2 - t_1 - 1);
frame.set("loop.first", t_1 === 0);
frame.set("loop.last", t_1 === t_2 - 1);
frame.set("loop.length", t_2);
childOutput += "\n    <li>";
lineno = 8; colno = 11; childOutput += runtime.suppressValue(
await runtime.awaitValue(t_4), env.opts.autoescape);
childOutput += "</li>\n    ";
}
}
frame = frame.pop();
childOutput += "\n  </ul>\n</body>\n</html>";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
root: root
};


  })();
  window.nunjucksPrecompiled["views/import-context-set.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
var t_1;
t_1 = "FOO";
frame.set("bar", t_1, true);
if(frame.topLevel) {
context.setVariable("bar", t_1);
}
if(frame.topLevel) {
context.addExport("bar", t_1);
}
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
root: root
};


  })();
  window.nunjucksPrecompiled["views/index.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
lineno = 0; colno = 3;
var t_2 = await env.getTemplate("base.html", true, "views/index.html", false);
parentTemplate = t_2
var __parentBlockNames = Object.keys(parentTemplate.blocks);
context.setParentBlockNames(__parentBlockNames);
for(var t_1 in parentTemplate.blocks) {
context.addBlock(t_1, parentTemplate.blocks[t_1]);
}
context.validateBlocks();
childOutput += "\n\n";
if(!parentTemplate) {
var t_3 = await (await context.getBlock("content"))(env, context, frame, runtime);
childOutput += t_3;
}
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
async function b_content(env, context, frame, runtime) {
var lineno = 2;
var colno = 3;
var output = "";
try {
var frame = frame.push(true);
output += "\nHello, ";
lineno = 3; colno = 41; output += runtime.suppressValue(
await runtime.awaitValue(env.getFilter("safe").call(context, await runtime.awaitValue(env.getFilter("default").call(context, runtime.contextOrFrameLookup(context, frame, "username"),"poop")))), env.opts.autoescape);
output += "! This is just some content.\n\n<div id=\"dynamic\"></div>\n";
return output;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
b_content: b_content,
root: root
};


  })();
  window.nunjucksPrecompiled["views/item-base.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
childOutput += "\nEditing item: ";
lineno = 1; colno = 17; childOutput += runtime.suppressValue(
await runtime.awaitValue(runtime.contextOrFrameLookup(context, frame, "name")), env.opts.autoescape);
childOutput += "\n\n";
if(!parentTemplate) {
var t_1 = await (await context.getBlock("description"))(env, context, frame, runtime);
childOutput += t_1;
}
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
async function b_description(env, context, frame, runtime) {
var lineno = 3;
var colno = 3;
var output = "";
try {
var frame = frame.push(true);
output += "\nA basic description is: ";
lineno = 4; colno = 27; output += runtime.suppressValue(
await runtime.awaitValue(runtime.contextOrFrameLookup(context, frame, "desc")), env.opts.autoescape);
output += "\n";
return output;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
b_description: b_description,
root: root
};


  })();
  window.nunjucksPrecompiled["views/item-card.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
childOutput += "<div class=\"item-card\">\n  <strong>";
lineno = 1; colno = 17; childOutput += runtime.suppressValue(
await runtime.awaitValue(runtime.memberLookup((runtime.contextOrFrameLookup(context, frame, "item")),"name")), env.opts.autoescape);
childOutput += "</strong>\n  <p>";
lineno = 2; colno = 12; childOutput += runtime.suppressValue(
await runtime.awaitValue(runtime.memberLookup((runtime.contextOrFrameLookup(context, frame, "item")),"desc")), env.opts.autoescape);
childOutput += "</p>\n</div>\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
root: root
};


  })();
  window.nunjucksPrecompiled["views/item.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
lineno = 0; colno = 3;
var t_2 = await env.getTemplate("item-base.html", true, "views/item.html", false);
parentTemplate = t_2
var __parentBlockNames = Object.keys(parentTemplate.blocks);
context.setParentBlockNames(__parentBlockNames);
for(var t_1 in parentTemplate.blocks) {
context.addBlock(t_1, parentTemplate.blocks[t_1]);
}
context.validateBlocks();
childOutput += "\n\n";
if(!parentTemplate) {
var t_3 = await (await context.getBlock("description"))(env, context, frame, runtime);
childOutput += t_3;
}
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
async function b_description(env, context, frame, runtime) {
var lineno = 2;
var colno = 3;
var output = "";
try {
var frame = frame.push(true);
output += "\nI told you, it's name is ";
lineno = 3; colno = 28; output += runtime.suppressValue(
await runtime.awaitValue(runtime.contextOrFrameLookup(context, frame, "name")), env.opts.autoescape);
output += ".\n\nIt also has the description: ";
lineno = 5; colno = 32; output += runtime.suppressValue(
await runtime.awaitValue(runtime.contextOrFrameLookup(context, frame, "desc")), env.opts.autoescape);
output += ".\n";
return output;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
b_description: b_description,
root: root
};


  })();
  window.nunjucksPrecompiled["views/items.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
lineno = 0; colno = 3;
var t_2 = await env.getTemplate("base.html", true, "views/items.html", false);
parentTemplate = t_2
var __parentBlockNames = Object.keys(parentTemplate.blocks);
context.setParentBlockNames(__parentBlockNames);
for(var t_1 in parentTemplate.blocks) {
context.addBlock(t_1, parentTemplate.blocks[t_1]);
}
context.validateBlocks();
childOutput += "\n\n";
if(!parentTemplate) {
var t_3 = await (await context.getBlock("content"))(env, context, frame, runtime);
childOutput += t_3;
}
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
async function b_content(env, context, frame, runtime) {
var lineno = 2;
var colno = 3;
var output = "";
try {
var frame = frame.push(true);
output += "\n<h2>Items List</h2>\n<p>Each item is rendered using an include:</p>\n\n<div class=\"items\">\n  ";
frame = frame.push();
var t_6 = runtime.contextOrFrameLookup(context, frame, "items");
if(t_6) {t_6 = runtime.fromIterator(t_6);
var t_5 = t_6.length;
for(var t_4=0; t_4 < t_6.length; t_4++) {
var t_7 = t_6[t_4];
frame.set("item", t_7);
frame.set("loop.index", t_4 + 1);
frame.set("loop.index0", t_4);
frame.set("loop.revindex", t_5 - t_4);
frame.set("loop.revindex0", t_5 - t_4 - 1);
frame.set("loop.first", t_4 === 0);
frame.set("loop.last", t_4 === t_5 - 1);
frame.set("loop.length", t_5);
output += "\n    ";
lineno = 8; colno = 7;
var t_8 = await env.getTemplate("item-card.html", false, {parentTmpl: "views/items.html", parentLineno: 9, parentColno: 8}, false);
var t_9 = await t_8.render(context.getVariables(), frame);output += t_9;
output += "\n  ";
}
}
frame = frame.pop();
output += "\n</div>\n";
return output;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
b_content: b_content,
root: root
};


  })();
  window.nunjucksPrecompiled["views/macro-demo.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
lineno = 0; colno = 3;
var t_2 = await env.getTemplate("base.html", true, "views/macro-demo.html", false);
parentTemplate = t_2
var __parentBlockNames = Object.keys(parentTemplate.blocks);
context.setParentBlockNames(__parentBlockNames);
for(var t_1 in parentTemplate.blocks) {
context.addBlock(t_1, parentTemplate.blocks[t_1]);
}
context.validateBlocks();
childOutput += "\n";
lineno = 1; colno = 3;
var t_3 = await env.getTemplate("macros.html", false, "views/macro-demo.html", false);
var t_3_exported = await t_3.getExported();
context.setVariable("macros", t_3_exported);
childOutput += "\n\n";
if(!parentTemplate) {
var t_4 = await (await context.getBlock("content"))(env, context, frame, runtime);
childOutput += t_4;
}
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
async function b_content(env, context, frame, runtime) {
var lineno = 3;
var colno = 3;
var output = "";
try {
var frame = frame.push(true);
output += "\n<h2>Macro Demo</h2>\n<p>Welcome, ";
lineno = 5; colno = 15; output += runtime.suppressValue(
await runtime.awaitValue(runtime.contextOrFrameLookup(context, frame, "username")), env.opts.autoescape);
output += "!</p>\n\n<h3>User Cards (using macro):</h3>\n";
lineno = 8; colno = 19; output += runtime.suppressValue(
await runtime.awaitValue((lineno = 8, colno = 19, runtime.callWrap(runtime.memberLookup((runtime.contextOrFrameLookup(context, frame, "macros")),"user_card"), "macros.user_card", "macros.user_card()", context, [runtime.contextOrFrameLookup(context, frame, "username"),"Active"], 8, 19))), env.opts.autoescape);
output += "\n";
lineno = 9; colno = 19; output += runtime.suppressValue(
await runtime.awaitValue((lineno = 9, colno = 19, runtime.callWrap(runtime.memberLookup((runtime.contextOrFrameLookup(context, frame, "macros")),"user_card"), "macros.user_card", "macros.user_card()", context, ["Jane","Inactive"], 9, 19))), env.opts.autoescape);
output += "\n";
lineno = 10; colno = 19; output += runtime.suppressValue(
await runtime.awaitValue((lineno = 10, colno = 19, runtime.callWrap(runtime.memberLookup((runtime.contextOrFrameLookup(context, frame, "macros")),"user_card"), "macros.user_card", "macros.user_card()", context, ["Bob","Active"], 10, 19))), env.opts.autoescape);
output += "\n\n<h3>Simple List:</h3>\n";
lineno = 13; colno = 21; output += runtime.suppressValue(
await runtime.awaitValue((lineno = 13, colno = 21, runtime.callWrap(runtime.memberLookup((runtime.contextOrFrameLookup(context, frame, "macros")),"simple_list"), "macros.simple_list", "macros.simple_list()", context, [["One","Two","Three"]], 13, 21))), env.opts.autoescape);
output += "\n";
return output;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
b_content: b_content,
root: root
};


  })();
  window.nunjucksPrecompiled["views/macros.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
var macro_t_1 = runtime.makeMacro(
["name", "status"], 
[], 
async function (l_name, l_status, kwargs) {
var callerFrame = frame;
frame = runtime.createFrame();
kwargs = kwargs || {};
if (Object.prototype.hasOwnProperty.call(kwargs, "caller")) {
frame.set("caller", kwargs.caller); }
frame.set("name", l_name);
frame.set("status", l_status);
var t_2 = "";t_2 += "\n<div class=\"user-card\" style=\"border: 1px solid #ccc; padding: 10px; margin: 5px;\">\n  <strong>";
lineno = 2; colno = 13; t_2 += runtime.suppressValue(
await runtime.awaitValue(l_name), env.opts.autoescape);
t_2 += "</strong>\n  <span class=\"status\">Status: ";
lineno = 3; colno = 34; t_2 += runtime.suppressValue(
await runtime.awaitValue(l_status), env.opts.autoescape);
t_2 += "</span>\n</div>\n";
frame = callerFrame;
return runtime.createSafeString(t_2);
});
context.addExport("user_card");
context.setVariable("user_card", macro_t_1);
childOutput += "\n\n";
var macro_t_3 = runtime.makeMacro(
["items"], 
[], 
async function (l_items, kwargs) {
var callerFrame = frame;
frame = runtime.createFrame();
kwargs = kwargs || {};
if (Object.prototype.hasOwnProperty.call(kwargs, "caller")) {
frame.set("caller", kwargs.caller); }
frame.set("items", l_items);
var t_4 = "";t_4 += "\n<ul>\n  ";
frame = frame.push();
var t_7 = l_items;
if(t_7) {t_7 = runtime.fromIterator(t_7);
var t_6 = t_7.length;
for(var t_5=0; t_5 < t_7.length; t_5++) {
var t_8 = t_7[t_5];
frame.set("item", t_8);
frame.set("loop.index", t_5 + 1);
frame.set("loop.index0", t_5);
frame.set("loop.revindex", t_6 - t_5);
frame.set("loop.revindex0", t_6 - t_5 - 1);
frame.set("loop.first", t_5 === 0);
frame.set("loop.last", t_5 === t_6 - 1);
frame.set("loop.length", t_6);
t_4 += "\n  <li>";
lineno = 10; colno = 9; t_4 += runtime.suppressValue(
await runtime.awaitValue(t_8), env.opts.autoescape);
t_4 += "</li>\n  ";
}
}
frame = frame.pop();
t_4 += "\n</ul>\n";
frame = callerFrame;
return runtime.createSafeString(t_4);
});
context.addExport("simple_list");
context.setVariable("simple_list", macro_t_3);
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
root: root
};


  })();
  window.nunjucksPrecompiled["views/set.html"] = (function() {
    
async function root(env, context, frame, runtime) {
var lineno = 0;
var colno = 0;
var output = "";
try {
var parentTemplate = null;
var childOutput = "";
var t_1;
t_1 = "foooo";
frame.set("username", t_1, true);
if(frame.topLevel) {
context.setVariable("username", t_1);
}
if(frame.topLevel) {
context.addExport("username", t_1);
}
childOutput += "\n";
if(parentTemplate) {
return await parentTemplate.rootRenderFunc(env, context, frame, runtime);
}
return childOutput;
} catch (e) {
  throw runtime.handleError(e, lineno, colno);
}
}
return {
root: root
};


  })();
})();\n
window.renderTemplate = window.renderTemplate || function(name, context) {
  var tmpl = window.nunjucksPrecompiled && window.nunjucksPrecompiled[name];
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
        return window.__nunjucksError.renderErrorHtml(e, name, e.lineno || 0);
      });
    }
    return result;
  } catch(e) {
    return window.__nunjucksError.renderErrorHtml(e, name, e.lineno || 0);
  }
};
})(typeof window !== "undefined" ? window : global);\n