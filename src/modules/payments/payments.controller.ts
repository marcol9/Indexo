import type { Request, Response } from "express";
import { paymentInputSchema } from "./payments.schema";
import { PaymentService } from "./payments.service";
import { InMemoryPaymentRepository } from "./payments.repository";

// Single in-memory store for the process lifetime
const paymentService = new PaymentService(new InMemoryPaymentRepository());

export function createPayment(req: Request, res: Response): void {
  const input = paymentInputSchema.parse(req.body);
  const { payment, created } = paymentService.submitPayment(input);
  res.status(created ? 201 : 200).json(payment);
}

export function listPayments(_req: Request, res: Response): void {
  res.status(200).json({ payments: paymentService.listPayments() });
}

