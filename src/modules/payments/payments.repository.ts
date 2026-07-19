import type { Payment } from "./payments.types";

/**
 * Port for payment persistence. The service
 * depends only on this interface, so storage can be swapped later without
 * touching the service or controller layer.
 */
export interface PaymentRepository {
  findByPaymentId(paymentId: string): Payment | undefined;
  save(payment: Payment): void;
  findAll(): Payment[];
}

/** In-memory adapter. A Map preserves insertion order */
export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly paymentsById = new Map<string, Payment>();

  findByPaymentId(paymentId: string): Payment | undefined {
    return this.paymentsById.get(paymentId);
  }

  save(payment: Payment): void {
    this.paymentsById.set(payment.paymentId, payment);
  }

  findAll(): Payment[] {
    return Array.from(this.paymentsById.values());
  }
}

