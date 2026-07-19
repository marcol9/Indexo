import express from "express";
import helmet from "helmet";
import { requestLogger } from "./common/middleware/requestLogger";
import { notFound } from "./common/middleware/notFound";
import { errorHandler } from "./common/middleware/errorHandler";
import { paymentsRouter } from "./modules/payments/payments.routes";

export const app = express();

app.use(helmet());

app.use(requestLogger);

// Small body size limit to avoid trivially large payload abuse.
app.use(express.json({ limit: "100kb" }));

app.use("/payments", paymentsRouter);

app.use(notFound);
app.use(errorHandler);
