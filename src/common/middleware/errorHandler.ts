import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError";

/**
 * Central error handler (see docs/solution_design.md §7). Must be registered
 * last, after notFound. Maps every error to a 4xx/5xx JSON response —
 * nothing thrown or rejected in a route handler reaches Express's defaults.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "ValidationError",
      message: "Invalid payment payload",
      details: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  // express.json() throws a SyntaxError with status 400 on malformed request bodies.
  if (err instanceof SyntaxError && (err as SyntaxError & { status?: number }).status === 400) {
    res.status(400).json({ error: "BadRequest", message: "Malformed JSON body" });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.name, message: err.message });
    return;
  }

  // Truly unexpected failure — never bad client input, so 500 is appropriate here only.
  console.error(err);
  res.status(500).json({ error: "InternalServerError", message: "Something went wrong" });
}

