import {
  collection,
  doc,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./client";

export type ReceiptStatus = "ACTIVO" | "FIRMADO" | "ANULADO";

export interface MoneyReceipt {
  id: string;
  userId: string;
  receiptNumber: string;
  rawNumber: number;
  date: string;
  amount: number;
  currency: "PYG" | "USD";
  payerName: string;
  payerRucCi?: string;
  receiverName: string;
  receiverRucCi?: string;
  concept: string;
  observations?: string;
  paymentMethod: string;
  paymentDetail?: string;
  status: ReceiptStatus;
  isSigned: boolean;
  signedAt?: string;
  canceledAt?: string;
  cancelReason?: string;
  createdAt?: any;
}

export async function getNextReceiptNumber(
  userId: string
): Promise<{ formatted: string; nextNum: number }> {
  try {
    const q = query(
      collection(db, "receipts"),
      where("userId", "==", userId)
    );

    const snapshot = await getDocs(q);
    let maxNum = 0;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (typeof data.rawNumber === "number" && data.rawNumber > maxNum) {
        maxNum = data.rawNumber;
      }
    });

    const nextNum = maxNum + 1;
    const formatted = String(nextNum).padStart(7, "0");
    return { formatted, nextNum };
  } catch (error) {
    console.error("Error al calcular correlativo:", error);
    return { formatted: "0000001", nextNum: 1 };
  }
}

export async function createMoneyReceipt(
  data: Omit<MoneyReceipt, "id" | "status" | "isSigned">
): Promise<string> {
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(
      ([_, v]) => v !== undefined && v !== null && v !== ""
    )
  );

  const docRef = await addDoc(collection(db, "receipts"), {
    ...cleanData,
    status: "ACTIVO",
    isSigned: false,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function getUserReceipts(userId: string): Promise<MoneyReceipt[]> {
  try {
    const q = query(
      collection(db, "receipts"),
      where("userId", "==", userId)
    );

    const snapshot = await getDocs(q);
    const list: MoneyReceipt[] = [];

    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as MoneyReceipt);
    });

    return list.sort((a, b) => (b.rawNumber || 0) - (a.rawNumber || 0));
  } catch (error) {
    console.error("Error obteniendo recibos:", error);
    return [];
  }
}

export async function markReceiptAsSigned(receiptId: string) {
  const ref = doc(db, "receipts", receiptId);
  await updateDoc(ref, {
    isSigned: true,
    status: "FIRMADO",
    signedAt: new Date().toISOString(),
  });
}

export async function cancelReceipt(receiptId: string, reason: string) {
  const ref = doc(db, "receipts", receiptId);
  await updateDoc(ref, {
    status: "ANULADO",
    cancelReason: reason,
    canceledAt: new Date().toISOString(),
  });
}