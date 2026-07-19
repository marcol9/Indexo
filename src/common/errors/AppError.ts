/**
 * Base class for errors that should be mapped directly to an HTTP response
 * by the central error-handling middleware (see docs/solution_design.md §7).
 */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** A request failed schema/business validation. Always maps to 400. */
export class ValidationError extends AppError {
  constructor(message = "Invalid request") {
    super(message, 400);
  }
}

/** No route/resource matched the request. Maps to 404. */
export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404);
  }
}

