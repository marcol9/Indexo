import { z } from "zod";

const CURRENCIES = ["EUR", "USD", "GBP"] as const;

// 2 letters followed by 13-32 alphanumeric characters -> 15-34 total,
// a basic sanity check per docs/solution_design.md §5 (not mod-97 validation).
const IBAN_PATTERN = /^[A-Z]{2}[0-9A-Za-z]{13,32}$/;

function hasAtMostTwoDecimalPlaces(value: number): boolean {
  return Math.round((value + Number.EPSILON) * 100) / 100 === value;
}

export const paymentInputSchema = z.object({
  paymentId: z.string().min(1, "paymentId is required"),
  amount: z
    .number({ invalid_type_error: "amount must be a number" })
    .positive("amount must be positive")
    .refine(hasAtMostTwoDecimalPlaces, "amount must have at most 2 decimal places"),
  currency: z.enum(CURRENCIES, {
    errorMap: () => ({ message: `currency must be one of ${CURRENCIES.join(", ")}` }),
  }),
  debtorIban: z.string().regex(IBAN_PATTERN, "debtorIban must be 2 letters followed by 13-32 alphanumeric characters"),
  creditorIban: z
    .string()
    .regex(IBAN_PATTERN, "creditorIban must be 2 letters followed by 13-32 alphanumeric characters"),
  reference: z.string().optional(),
});

export type PaymentInput = z.infer<typeof paymentInputSchema>;

