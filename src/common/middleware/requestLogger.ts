import morgan from "morgan";

// "dev" format logs method/path/status/response time only — no request bodies,
// so no payment data ever reaches the logs (see docs/solution_design.md §8).
export const requestLogger = morgan("dev");

