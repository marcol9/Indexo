export type Currency = "EUR" | "USD" | "GBP";

/** A payment accepted into the store */
export interface Payment {
  paymentId: string;
  amount: number;
  currency: Currency;
  debtorIban: string;
  creditorIban: string;
  reference?: string;
}

