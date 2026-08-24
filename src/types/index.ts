export type Currency = "PYG" | "USD";

export type TransactionType = "income" | "expense";

export type PaymentMethod =
  | "cash"
  | "credit_card"
  | "debit_card"
  | "transfer"
  | "cheque"
  | "billetera"
  | "giro"
  | "otro";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  date: string;
  categoryId: string;
  subcategoryId?: string;
  description: string;
  counterpartyName?: string;
  amountInWords?: string;
  receiptNumber?: string;
  paymentMethod: PaymentMethod;
  isRecurring?: boolean;
  installmentId?: string;
  documentUrl?: string;
  createdAt?: any;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  monthlyLimit: number;
  currency: Currency;
  spent?: number;
}