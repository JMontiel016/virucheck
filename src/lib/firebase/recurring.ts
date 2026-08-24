import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./client";
import { RecurringExpense, Currency } from "@/types";

export async function getUserRecurringExpenses(userId: string): Promise<RecurringExpense[]> {
  const q = query(
    collection(db, "recurring"),
    where("userId", "==", userId)
  );

  const querySnapshot = await getDocs(q);
  const recurring: RecurringExpense[] = [];

  querySnapshot.forEach((docSnap) => {
    recurring.push({ id: docSnap.id, ...docSnap.data() } as RecurringExpense);
  });

  // Ordenar por día de vencimiento del mes (1 al 31)
  return recurring.sort((a, b) => a.dueDay - b.dueDay);
}

export async function createRecurringExpense(data: {
  userId: string;
  description: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  dueDay: number;
}) {
  const docRef = await addDoc(collection(db, "recurring"), {
    userId: data.userId,
    description: data.description,
    amount: data.amount,
    currency: data.currency,
    categoryId: data.categoryId,
    dueDay: data.dueDay,
    isActive: true,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function toggleRecurringStatus(id: string, currentStatus: boolean) {
  const docRef = doc(db, "recurring", id);
  await updateDoc(docRef, {
    isActive: !currentStatus,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRecurringExpense(id: string) {
  const docRef = doc(db, "recurring", id);
  await deleteDoc(docRef);
}