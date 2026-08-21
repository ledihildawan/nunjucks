import { isKeyedObject } from '@nunjucks/lib';

/**
 * Structural shape guard for parser extension objects: a keyed object carrying
 * a `tags` array of strings plus a `parse` callable. Class instances with these
 * members pass (`isKeyedObject` accepts any non-null object), matching the
 * classic extension authoring style.
 *
 * WHY: single source of truth for the extension shape — consumed by config
 * validation (fail-fast at the factory/render boundaries) and by the compile
 * pipeline's defensive filter, so the two checks can never drift apart. Lives
 * here (not in `@nunjucks/parser`) because the DAG forbids validators from
 * importing parser types.
 */
export const isParserExtensionShape = (value: unknown): boolean =>
  isKeyedObject(value) &&
  Array.isArray(value.tags) &&
  value.tags.every((tag) => typeof tag === 'string') &&
  typeof value.parse === 'function';
