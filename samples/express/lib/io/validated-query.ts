import type { Request, Response } from 'express';
import type { ZodType, ZodError } from 'zod';

interface ReadValidatedQueryOptions<T> {
  schema: ZodType<T>;
  req: Request;
  res: Response;
}

/**
 * Discriminated union indicating whether query validation succeeded or the response
 * was already sent with an error. Using a proper union instead of `null` sentinel
 * makes the control flow explicit and prevents accidental null dereference.
 */
type ReadValidatedQueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; responseSent: true; errors: ZodError['issues'] };

/**
 * Validates the request's untrusted query string against a zod schema — the single
 * boundary where query input enters a route. On failure, writes the 400 JSON
 * rejection (`{ ok: false, errors }`) itself and returns `{ ok: false, responseSent: true }`;
 * the caller must check `result.ok` and return immediately on failure. On success,
 * returns `{ ok: true, data: parsedQuery }` with the validated query.
 *
 * @param options - Schema to apply, plus the Express request/response pair.
 * @returns Discriminated union indicating success with data or failure with response already sent.
 */
const readValidatedQuery = <T>({
  schema,
  req,
  res,
}: ReadValidatedQueryOptions<T>): ReadValidatedQueryResult<T> => {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ ok: false, errors: parsed.error.issues });
    return { ok: false, responseSent: true, errors: parsed.error.issues };
  }
  return { ok: true, data: parsed.data };
};

export { readValidatedQuery, type ReadValidatedQueryResult };
