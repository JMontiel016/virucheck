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
import { Budget } from "@/types";

export async function getUserBudgets(userId: string, monthYear?: string): Promise<Budget[]> {
  const currentMonth = monthYear || new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const q = query(
    collection(db, "budgets"),
    where("userId", "==", userId),
    where("monthYear", "==", currentMonth)
  );

  const querySnapshot = await getDocs(q);
  const budgets: Budget[] = [];

  querySnapshot.forEach((docSnap) => {
    budgets.push({ id: docSnap.id, ...docSnap.data() } as Budget);
  });

  return budgets;
}

export async function createOrUpdateBudget(
  userId: string,
  categoryId: string,
  limit: number,
  currency: "PYG" | "USD" = "PYG",
  monthYear?: string
) {
  const targetMonth = monthYear || new Date().toISOString().slice(0, 7);
  const q = query(
    collection(db, "budgets"),
    where("userId", "==", userId),
    where("categoryId", "==", categoryId),
    where("monthYear", "==", targetMonth)
  );

  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    // Actualizar existente
    const docRef = doc(db, "budgets", querySnapshot.docs[0].id);
    await updateDoc(docRef, { limit, currency, updatedAt: serverTimestamp() });
  } else {
    // Crear nuevo
    await addDoc(collection(db, "budgets"), {
      userId,
      categoryId,
      limit,
      currency,
      monthYear: targetMonth,
      createdAt: serverTimestamp(),
    });
  }
}

export async function deleteBudget(budgetId: string) {
  const docRef = doc(db, "budgets", budgetId);
  await deleteDoc(docRef);
}