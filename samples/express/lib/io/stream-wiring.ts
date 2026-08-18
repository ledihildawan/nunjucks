import type { NunjucksEngine } from '@nunjucks/core';
import type { NextFunction, Request, Response } from 'express';

// WHY: shared pipeRenderStream guardrails — every streaming route gets the same per-chunk
// idle timeout and output-size breaker so no route can stream unbounded output.
const streamIdleTimeoutMs = 10000;
const streamMaxOutputBytes = 2 * 1024 * 1024;

// WHY: wires an Express client-disconnect to an AbortSignal so pipeRenderStream can abort the render and cascade-cleanup the moment the browser closes the connection. The `!res.writableEnded` guard avoids a spurious abort after the response has already completed normally. The listener lives for the request lifecycle (GC'd with req) — no leak.
const createDisconnectSignal = (req: Request, res: Response): AbortSignal => {
  const controller = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  });
  return controller.signal;
};

interface StreamTemplateToResponseOptions {
  engine: NunjucksEngine;
  template: string;
  context: Record<string, unknown>;
  req: Request;
  res: Response;
  next: NextFunction;
  label: string;
}

/**
 * Renders a template as a stream and pipes it into the Express response under the
 * demo's shared guardrails (client-disconnect signal, per-chunk idle timeout,
 * output-size breaker) with per-phase error and completion observability. A
 * pre-stream failure never touches the response — it is delegated to the central
 * error middleware via `next`.
 *
 * WHY: this exact wiring was triplicated across the streaming routes with only the
 * log label varying, so the steps live here once. Per-request console output for
 * streaming observability also lives here and ONLY here — one io module owns it,
 * deliberately without env gating, because the demo server's stream behavior is
 * the thing being observed.
 *
 * @param options - Engine (from stream-engines), template name or inline source,
 *   render context, Express request/response, `next` for the pre-stream error
 *   path, and the `[label]` prefix for log lines.
 */
const streamTemplateToResponse = async ({
  engine,
  template,
  context,
  req,
  res,
  next,
  label,
}: StreamTemplateToResponseOptions): Promise<void> => {
  const streamResult = await engine.renderToStream(template, context);
  if (!streamResult.ok) {
    next(streamResult.error);
    return;
  }
  await engine.pipeRenderStream(streamResult, res, {
    signal: createDisconnectSignal(req, res),
    timeoutMs: streamIdleTimeoutMs,
    maxOutputSize: streamMaxOutputBytes,
    onError: (err, phase) => {
      console.error(`[${label}] ${phase} error: ${err.message}`);
    },
    onComplete: (stats) => {
      console.log(
        `[${label}] ${stats.chunks} chunks, ${stats.errors} errors, ${(stats.bytes / 1024).toFixed(1)}KB`
      );
    },
  });
};

export { streamTemplateToResponse };
