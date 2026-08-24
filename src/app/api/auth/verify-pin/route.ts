import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/client";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";

export async function POST(req: NextRequest) {
  try {
    const { email, pin } = await req.json();

    if (!email || !pin) {
      return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
    }

    const q = query(
      collection(db, "password_resets"),
      where("email", "==", email.trim()),
      where("pin", "==", pin.trim()),
      where("used", "==", false)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "El código de seguridad es incorrecto o ya fue utilizado." },
        { status: 400 }
      );
    }

    const resetDoc = snapshot.docs[0];
    const data = resetDoc.data();

    if (Date.now() > data.expiresAt) {
      return NextResponse.json(
        { error: "El código ha expirado (validez: 15 minutos). Solicita uno nuevo." },
        { status: 400 }
      );
    }

    // Marcar como usado
    await updateDoc(doc(db, "password_resets", resetDoc.id), {
      used: true,
    });

    return NextResponse.json({ success: true, message: "Código validado correctamente." });
  } catch (error: any) {
    console.error("Error en verify-pin:", error);
    return NextResponse.json({ error: "Error validando el código." }, { status: 500 });
  }
}