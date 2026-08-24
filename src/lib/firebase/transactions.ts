import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./client";
import { Transaction, TransactionType, PaymentMethod, Currency } from "@/types";

export interface CreateTransactionDTO {
  userId: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  date: string;
  categoryId: string;
  subcategoryId?: string;
  description: string;
  counterpartyName: string;
  amountInWords?: string;
  receiptNumber?: string;
  paymentMethod: PaymentMethod;
  isRecurring?: boolean;
  installmentId?: string;
  documentUrl?: string;
}

export async function getUserTransactions(
  userId: string,
  maxItems = 100
): Promise<Transaction[]> {
  const q = query(
    collection(db, "transactions"),
    where("userId", "==", userId),
    orderBy("date", "desc"),
    limit(maxItems)
  );

  const querySnapshot = await getDocs(q);
  const transactions: Transaction[] = [];

  querySnapshot.forEach((docSnap) => {
    transactions.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
  });

  return transactions;
}

export async function createTransaction(data: CreateTransactionDTO) {
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  );

  const docRef = await addDoc(collection(db, "transactions"), {
    ...cleanData,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function updateTransaction(
  id: string,
  data: Partial<CreateTransactionDTO>
) {
  const docRef = doc(db, "transactions", id);
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  );

  await updateDoc(docRef, {
    ...cleanData,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTransaction(id: string) {
  const docRef = doc(db, "transactions", id);
  await deleteDoc(docRef);
}