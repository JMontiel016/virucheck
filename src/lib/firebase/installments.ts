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
import { Installment, Currency } from "@/types";

export async function getUserInstallments(userId: string): Promise<Installment[]> {
  const q = query(
    collection(db, "installments"),
    where("userId", "==", userId)
  );

  const querySnapshot = await getDocs(q);
  const installments: Installment[] = [];

  querySnapshot.forEach((docSnap) => {
    installments.push({ id: docSnap.id, ...docSnap.data() } as Installment);
  });

  return installments;
}

export async function createInstallment(data: {
  userId: string;
  description: string;
  totalAmount: number;
  currency: Currency;
  totalInstallments: number;
  firstDueDate: string;
}) {
  const monthlyAmount = Math.round(data.totalAmount / data.totalInstallments);

  const docRef = await addDoc(collection(db, "installments"), {
    userId: data.userId,
    description: data.description,
    totalAmount: data.totalAmount,
    currency: data.currency,
    totalInstallments: data.totalInstallments,
    currentInstallment: 0, // Cuotas pagadas hasta ahora
    monthlyAmount: monthlyAmount,
    firstDueDate: data.firstDueDate,
    status: "active",
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function payNextInstallment(installment: Installment) {
  const nextNumber = installment.currentInstallment + 1;
  const isCompleted = nextNumber >= installment.totalInstallments;

  const docRef = doc(db, "installments", installment.id);
  await updateDoc(docRef, {
    currentInstallment: nextNumber,
    status: isCompleted ? "completed" : "active",
    updatedAt: serverTimestamp(),
  });
}

export async function deleteInstallment(installmentId: string) {
  const docRef = doc(db, "installments", installmentId);
  await deleteDoc(docRef);
}