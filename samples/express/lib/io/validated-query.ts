import type { Request, Response } from 'express';
import type { ZodType } from 'zod';

interface ReadValidatedQueryOptions<T> {
  schema: ZodType<T>;
  req: Request;
  res: Response;
}

/**
 * Validates the request's untrusted query string against a zod schema — the single
 * boundary where query input enters a route. On failure, writes the 400 JSON
 * rejection (`{ ok: false, errors }`) itself and returns `null`; the caller must
 * treat `null` as "response already sent" and return immediately. On success,
 * returns the parsed value and nothing has been written.
 *
 * @param options - Schema to apply, plus the Express request/response pair.
 * @returns The parsed query, or `null` when a 400 response has already been sent.
 */
const readValidatedQuery = <T>({ schema, req, res }: ReadValidatedQueryOptions<T>): T | null => {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ ok: false, errors: parsed.error.issues });
    return null;
  }
  return parsed.data;
};

export { readValidatedQuery };
