import type { NextFunction, Request, RequestHandler, Response } from "express";

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

/**
 * Wraps a route handler (sync or async) so that thrown errors and rejected
 * promises are forwarded to `next()`, reaching the central errorHandler
 * instead of crashing the process (see docs/solution_design.md §7).
 */
export function asyncHandler(handler: Handler): RequestHandler {
  return (req, res, next) => {
    try {
      Promise.resolve(handler(req, res, next)).catch(next);
    } catch (err) {
      next(err);
    }
  };
}

