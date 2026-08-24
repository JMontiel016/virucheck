import { db } from "@/lib/firebase/client";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { IncomeProfile, AdditionalIncome } from "@/types/income";

// Guardar o actualizar perfil salarial principal
export async function saveIncomeProfile(userId: string, data: Omit<IncomeProfile, "userId" | "updatedAt">) {
  const ref = doc(db, "income_profiles", userId);
  await setDoc(
    ref,
    {
      ...data,
      userId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// Obtener perfil salarial
export async function getIncomeProfile(userId: string): Promise<IncomeProfile | null> {
  const ref = doc(db, "income_profiles", userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as IncomeProfile;
}

// Agregar ingreso adicional
export async function addAdditionalIncome(userId: string, data: Omit<AdditionalIncome, "userId" | "createdAt">) {
  const ref = collection(db, "additional_incomes");
  const docRef = await addDoc(ref, {
    ...data,
    userId,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// Obtener ingresos adicionales
export async function getAdditionalIncomes(userId: string): Promise<AdditionalIncome[]> {
  const q = query(
    collection(db, "additional_incomes"),
    where("userId", "==", userId),
    orderBy("date", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdditionalIncome));
}

// Eliminar ingreso adicional
export async function deleteAdditionalIncome(id: string) {
  await deleteDoc(doc(db, "additional_incomes", id));
}