import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { db } from "@/lib/firebase/client";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body?.email ? String(body.email).trim().toLowerCase() : "";

    if (!email) {
      return NextResponse.json(
        { error: "Por favor ingresa un correo electrónico válido." },
        { status: 400 }
      );
    }

    const smtpUser = process.env.SMTP_EMAIL;
    const smtpPass = process.env.SMTP_PASSWORD;

    if (!smtpUser || !smtpPass) {
      console.error("Faltan las credenciales SMTP_EMAIL o SMTP_PASSWORD en .env.local");
      return NextResponse.json(
        { error: "El servicio de correos no está configurado en .env.local (falta SMTP_EMAIL o SMTP_PASSWORD)." },
        { status: 500 }
      );
    }

    // 1. Generar PIN de 6 dígitos (validez de 10 minutos)
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    // 2. Guardar PIN en Firestore
    await addDoc(collection(db, "password_resets"), {
      email,
      pin,
      expiresAt,
      used: false,
      createdAt: serverTimestamp(),
    });

    // 3. Crear transportador y enviar correo
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: `"ViruCheck" <${smtpUser}>`,
      to: email,
      subject: `${pin} es tu código de recuperación de ViruCheck`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #0b1329; color: #ffffff; border-radius: 16px;">
          <h2 style="color: #38bdf8; text-align: center; margin-top: 0;">ViruCheck</h2>
          <p style="font-size: 14px; color: #cbd5e1;">Hola,</p>
          <p style="font-size: 14px; color: #cbd5e1;">Has solicitado restablecer tu contraseña. Ingresa el siguiente código de seguridad de 6 dígitos en la aplicación:</p>
          <div style="background-color: #1e293b; border-radius: 10px; padding: 16px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #38bdf8; font-family: monospace;">${pin}</span>
          </div>
          <p style="font-size: 12px; color: #94a3b8;">Este código vence en <strong>10 minutos</strong>. Si no solicitaste este cambio, ignora este mensaje.</p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: "Código de seguridad enviado a tu correo.",
    });
  } catch (error: any) {
    console.error("Error detallado al enviar correo:", error);
    return NextResponse.json(
      { error: `Error al enviar correo: ${error.message || "Fallo en el servidor de correo"}` },
      { status: 500 }
    );
  }
}