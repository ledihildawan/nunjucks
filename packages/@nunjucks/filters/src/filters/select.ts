import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import { err, getAttrGetter, ok, type Result } from '@nunjucks/lib';
import { createComponent, runTest } from '@nunjucks/runtime';
import {
  createFilterError,
  type FilterContext,
  isArray,
  requireArrayError,
} from '../factory/index.ts';

const DEFAULT_TEST_NAME = 'truthy';

// WHY: createComponent (not createFilter) with a NON-arrow impl — the impl must read
// `this` (the render context runFilter binds via filter.call(context, ...)) to reach
// env.getTest for custom tests; createFilter's arrow wrapper would discard it.
const createSelectOrReject = (expectedTestResult: boolean) =>
  createComponent({
    argNames: ['arr', 'testName', 'secondArg'],
    kwargNames: [],
    func: function (
      this: FilterContext,
      arr: unknown,
      testName: unknown,
      secondArg: unknown
    ): Result<unknown[], TemplateError> {
      if (!isArray(arr)) {
        return err(requireArrayError(arr, ERROR_DEFINITIONS.LIST_FILTER));
      }
      const testNameValue = typeof testName === 'string' ? testName : DEFAULT_TEST_NAME;
      // WHY: runTest is the exact channel the compiler emits for `x is <test>` —
      // builtin predicates first, then the env's getTest hook — so select/reject
      // resolve tests identically to `is` without a new package dependency. Unknown
      // builtin names read as false (runTest's branch-free contract); unknown custom
      // names still surface through env.getTest's catalogued UNDEFINED_TEST throw.
      return ok(
        arr.filter(
          (item) => runTest(this?.env, testNameValue, item, secondArg) === expectedTestResult
        )
      );
    },
  });

/** Keeps items whose test passes: `select(test='truthy', secondArg)`. */
export const select = createSelectOrReject(true);

/** Keeps items whose test fails: `reject(test='truthy', secondArg)`. */
export const reject = createSelectOrReject(false);

const requireAttrNameError = (filterName: string, attr: unknown): TemplateError =>
  createFilterError({
    errorDef: undefined,
    params: { type: typeof attr },
    subject: String(attr),
    fallbackMessage: `${filterName}: expected a non-empty attribute name`,
  });

const createSelectOrRejectAttr = (keepWhenPresent: boolean, filterName: string) =>
  createComponent({
    argNames: ['arr', 'attr'],
    kwargNames: [],
    func: (arr: unknown, attr: unknown): Result<unknown[], TemplateError> => {
      if (!isArray(arr)) {
        return err(requireArrayError(arr, ERROR_DEFINITIONS.LIST_FILTER));
      }
      if (typeof attr !== 'string' || attr === '') {
        return err(requireAttrNameError(filterName, attr));
      }
      // WHY: no validateItemsHaveAttr — upstream filters on the plain truthiness of
      // the resolved attribute, so items lacking `attr` are simply excluded (or kept
      // by rejectattr) instead of failing the whole filter; dotted paths resolve via
      // the same own-property walk the other attribute filters use.
      const getAttr = getAttrGetter(attr);
      return ok(arr.filter((item) => Boolean(getAttr(item)) === keepWhenPresent));
    },
  });

/** Keeps items on which `attr` resolves truthy: `selectattr(attr)`. */
export const selectattr = createSelectOrRejectAttr(true, 'selectattr');

/** Keeps items on which `attr` resolves falsy: `rejectattr(attr)`. */
export const rejectattr = createSelectOrRejectAttr(false, 'rejectattr');
