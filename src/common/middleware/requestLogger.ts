import morgan from "morgan";

// "dev" format logs method/path/status/response time only — no request bodies,
// so no payment data ever reaches the logs
export const requestLogger = morgan("dev");

