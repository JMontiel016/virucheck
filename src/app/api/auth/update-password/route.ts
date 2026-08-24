import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/client";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { adminAuth } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body?.email ? String(body.email).trim().toLowerCase() : "";
    const pin = body?.pin ? String(body.pin).trim() : "";
    const newPassword = body?.newPassword ? String(body.newPassword) : "";

    if (!email || !pin) {
      return NextResponse.json(
        { error: "El correo y el código PIN son obligatorios." },
        { status: 400 }
      );
    }

    // 1. Validar el PIN y vigencia (10 min)
    const q = query(
      collection(db, "password_resets"),
      where("email", "==", email),
      where("pin", "==", pin),
      where("used", "==", false)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "El código PIN es incorrecto o ya fue utilizado." },
        { status: 400 }
      );
    }

    const resetDoc = snapshot.docs[0];
    const data = resetDoc.data();

    if (Date.now() > data.expiresAt) {
      return NextResponse.json(
        { error: "El código PIN ha expirado (10 minutos). Solicita uno nuevo." },
        { status: 400 }
      );
    }

    // Si solo estamos validando el PIN (sin cambiar clave todavía)
    if (!newPassword) {
      return NextResponse.json({
        success: true,
        message: "Código PIN verificado correctamente.",
      });
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "La nueva contraseña debe tener mínimo 6 caracteres." },
        { status: 400 }
      );
    }

    // 2. Modificar la contraseña real en Firebase Auth usando Admin SDK
    const userRecord = await adminAuth.getUserByEmail(email);
    await adminAuth.updateUser(userRecord.uid, {
      password: newPassword,
    });

    // 3. Marcar PIN como consumido
    await updateDoc(doc(db, "password_resets", resetDoc.id), {
      used: true,
    });

    return NextResponse.json({
      success: true,
      message: "¡Contraseña actualizada exitosamente!",
    });
  } catch (error: any) {
    console.error("Error al actualizar contraseña:", error);
    return NextResponse.json(
      { error: error.message || "Error al actualizar la contraseña." },
      { status: 500 }
    );
  }
}