import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/client";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body?.email ? String(body.email).trim().toLowerCase() : "";

    if (!email) {
      return NextResponse.json(
        { error: "Por favor ingresa tu correo electrónico." },
        { status: 400 }
      );
    }

    // 1. Verificar si el usuario existe
    try {
      const userQ = query(collection(db, "users"), where("email", "==", email));
      const userSnap = await getDocs(userQ);

      if (userSnap.empty) {
        return NextResponse.json(
          { error: "El correo ingresado no se encuentra registrado en el sistema." },
          { status: 404 }
        );
      }
    } catch (permError) {
      console.warn("Aviso de verificación de usuario:", permError);
    }

    // 2. Generar código PIN de 6 dígitos
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos

    // 3. Guardar el PIN en la colección password_resets
    await addDoc(collection(db, "password_resets"), {
      email,
      pin,
      expiresAt,
      used: false,
      createdAt: serverTimestamp(),
    });

    console.log(`[ViruCheck] Código PIN generado para ${email}: ${pin}`);

    return NextResponse.json({
      success: true,
      message: "Código de seguridad de 6 dígitos generado con éxito.",
      devPin: pin,
    });
  } catch (error: any) {
    console.error("Error al generar código PIN:", error);
    return NextResponse.json(
      { error: "No se pudo generar el código. Verifica la conexión o las reglas de base de datos." },
      { status: 500 }
    );
  }
}