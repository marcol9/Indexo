import type { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../errors/AppError";

/** Fallback for any request that didn't match a route. Forwarded to errorHandler as a 404. */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
}

