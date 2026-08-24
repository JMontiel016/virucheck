import { db } from "./client";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

export interface SalaryConfig {
  id?: string;
  userId: string;
  amount: number;
  currency: string;
  isFixed: boolean;
  frequency: string;
  employerName: string;
  paymentDay: number;
  notes?: string;
  workerType?: "dependent" | "independent";
  hasIps?: boolean;
  appliesIva?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export async function saveSalaryConfig(data: Omit<SalaryConfig, "createdAt" | "updatedAt"> & { id?: string }) {
  const colRef = collection(db, "salaries");
  const docRef = data.id ? doc(db, "salaries", data.id) : doc(colRef);

  const payload: any = {
    ...data,
    id: docRef.id,
    updatedAt: serverTimestamp(),
  };

  if (!data.id) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(docRef, payload, { merge: true });
  return docRef.id;
}

export async function getUserSalaries(userId: string): Promise<SalaryConfig[]> {
  try {
    const colRef = collection(db, "salaries");
    const q = query(colRef, where("userId", "==", userId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as SalaryConfig[];
  } catch (error) {
    console.error("Error al obtener salarios:", error);
    return [];
  }
}

export async function deleteSalaryConfig(id: string) {
  const docRef = doc(db, "salaries", id);
  await deleteDoc(docRef);
}