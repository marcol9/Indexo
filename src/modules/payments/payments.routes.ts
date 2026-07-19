import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { createPayment, listPayments } from "./payments.controller";

export const paymentsRouter = Router();

paymentsRouter.post("/", asyncHandler(createPayment));
paymentsRouter.get("/", asyncHandler(listPayments));

