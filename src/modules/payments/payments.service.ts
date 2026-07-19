import type { PaymentInput } from "./payments.schema";
import type { PaymentRepository } from "./payments.repository";
import type { Payment } from "./payments.types";

export interface SubmitPaymentResult {
  payment: Payment;
  /** false when this paymentId was already accepted — see docs/solution_design.md §6. */
  created: boolean;
}

export class PaymentService {
  constructor(private readonly repository: PaymentRepository) {}

  /** Dedupes by paymentId: a retry returns the already-stored payment instead of creating a new one. */
  submitPayment(input: PaymentInput): SubmitPaymentResult {
    const existing = this.repository.findByPaymentId(input.paymentId);
    if (existing) {
      return { payment: existing, created: false };
    }

    const payment: Payment = { ...input };
    this.repository.save(payment);
    return { payment, created: true };
  }

  listPayments(): Payment[] {
    return this.repository.findAll();
  }
}

