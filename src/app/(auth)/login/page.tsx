/**
 * ============================================================================
 * PÁGINA DE INICIO DE SESIÓN - VIRUCHECK
 * ============================================================================
 * - Autenticación por correo y contraseña.
 * - Recuperación de cuenta mediante PIN de seguridad.
 * - Soporte para Google con intercepción obligatoria de nombre y contraseña doble para cuentas nuevas.
 * - Diseño moderno responsivo (Móvil y Escritorio con efectos Glassmorphism).
 */

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/client";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wallet,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  ShieldCheck,
  User,
  Sparkles,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { loginWithEmail, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ type: "error" | "success"; text: string } | null>(null);

  // Estados de control para el flujo PIN de Recuperación o Nuevo Registro de Google
  const [step, setStep] = useState<"login" | "request_pin" | "enter_pin" | "new_password" | "google_new_user">("login");
  const [pinCode, setPinCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Estados específicos para el registro nuevo por Google
  const [tempGoogleUser, setTempGoogleUser] = useState<any>(null);
  const [customName, setCustomName] = useState("");
  const [googlePassword, setGooglePassword] = useState("");
  const [confirmGooglePassword, setConfirmGooglePassword] = useState("");

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertInfo(null);
    setLoading(true);

    try {
      await loginWithEmail(email.trim(), password);
      router.push("/");
    } catch (err: any) {
      console.error(err);
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found"
      ) {
        setAlertInfo({ type: "error", text: "Credenciales inválidas. Verifica tu correo y contraseña." });
      } else {
        setAlertInfo({ type: "error", text: "No se pudo iniciar sesión. Intenta nuevamente." });
      }
    } finally {
      setLoading(false);
    }
  };

  // 1. Solicitar PIN de recuperación
  const handleRequestPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setAlertInfo({ type: "error", text: "Por favor ingresa tu correo electrónico." });
      return;
    }

    setLoading(true);
    setAlertInfo(null);

    try {
      const res = await fetch("/api/auth/send-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo enviar el código.");

      setAlertInfo({
        type: "success",
        text: `Código enviado a ${email}. Revisa tu bandeja de entrada o spam.`,
      });
      setPinCode("");
      setStep("enter_pin");
    } catch (err: any) {
      setAlertInfo({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // 2. Validar PIN
  const handleVerifyPinOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinCode.trim().length !== 6) {
      setAlertInfo({ type: "error", text: "El código PIN debe tener 6 números." });
      return;
    }

    setLoading(true);
    setAlertInfo(null);

    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), pin: pinCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Código PIN inválido.");

      setAlertInfo({ type: "success", text: "¡Código verificado! Ahora escribe tu nueva contraseña." });
      setStep("new_password");
    } catch (err: any) {
      setAlertInfo({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // 3. Guardar nueva contraseña
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setAlertInfo({ type: "error", text: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }

    setLoading(true);
    setAlertInfo(null);

    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), pin: pinCode.trim(), newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar la contraseña.");

      setAlertInfo({ type: "success", text: "¡Contraseña actualizada con éxito! Entrando..." });
      await loginWithEmail(email.trim(), newPassword);
      router.push("/");
    } catch (err: any) {
      setAlertInfo({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  /**
   * INICIO DE SESIÓN CON GOOGLE (DETECCIÓN DE USUARIO NUEVO)
   */
  const handleGoogleLogin = async () => {
    setAlertInfo(null);
    setGoogleLoading(true);
    try {
      const { user: firebaseUser, isNewUser } = await loginWithGoogle();

      if (!firebaseUser) {
        throw new Error("No se pudo obtener la información de Google.");
      }

      if (isNewUser) {
        // Es un usuario nuevo: Interceptamos y pedimos nombre + doble contraseña
        setTempGoogleUser(firebaseUser);
        setCustomName(firebaseUser.displayName || "");
        setStep("google_new_user");
      } else {
        router.push("/");
      }
    } catch (err: any) {
      console.error(err);
      setAlertInfo({ type: "error", text: "No se pudo iniciar sesión con Google." });
    } finally {
      setGoogleLoading(false);
    }
  };

  /**
   * GUARDAR DATOS DEL NUEVO USUARIO DE GOOGLE (Usa setDoc con merge para evitar errores)
   */
  const handleSaveGoogleNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempGoogleUser) return;

    if (googlePassword.length < 6) {
      setAlertInfo({ type: "error", text: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }

    if (googlePassword !== confirmGooglePassword) {
      setAlertInfo({ type: "error", text: "Las contraseñas no coinciden. Por favor, verifica." });
      return;
    }

    if (!customName.trim()) {
      setAlertInfo({ type: "error", text: "Por favor ingresa un nombre de usuario válido." });
      return;
    }

    setLoading(true);
    setAlertInfo(null);

    try {
      await updateProfile(tempGoogleUser, {
        displayName: customName.trim(),
      });

      const userDocRef = doc(db, "users", tempGoogleUser.uid);
      await setDoc(userDocRef, {
        uid: tempGoogleUser.uid,
        email: tempGoogleUser.email,
        displayName: customName.trim(),
        photoURL: tempGoogleUser.photoURL || "",
        customPassword: googlePassword,
        createdAt: serverTimestamp(),
        hasCustomPassword: true,
      }, { merge: true });

      setAlertInfo({ type: "success", text: "¡Cuenta configurada con éxito! Entrando..." });
      router.push("/");
    } catch (err: any) {
      console.error(err);
      setAlertInfo({ type: "error", text: err.message || "No se pudo guardar la configuración." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 bg-slate-950 overflow-hidden">
      <div className="absolute top-[-15%] left-[-10%] w-[350px] sm:w-[450px] h-[350px] sm:h-[450px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[350px] sm:w-[450px] h-[350px] sm:h-[450px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-[420px] rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center text-center space-y-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25">
            {step === "login" ? <Wallet className="h-6 w-6" /> : step === "google_new_user" ? <Sparkles className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
          </div>

          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {step === "login"
                ? "Iniciar Sesión"
                : step === "request_pin"
                ? "Recuperar Cuenta"
                : step === "enter_pin"
                ? "Ingresar Código PIN"
                : step === "new_password"
                ? "Nueva Contraseña"
                : "Personaliza tu Cuenta"}
            </h1>
            <p className="text-xs text-slate-400">
              {step === "login"
                ? "Sistema de gestión patrimonial y recibos"
                : step === "request_pin"
                ? "Ingresa tu correo para recibir un código de seguridad"
                : step === "enter_pin"
                ? `Ingresa los 6 números enviados a ${email}`
                : step === "new_password"
                ? "Escribe tu nueva contraseña de acceso"
                : "Es tu primera vez con Google. Elige tu nombre y contraseña de seguridad."}
            </p>
          </div>
        </div>

        {alertInfo && (
          <div
            className={`mb-4 flex items-start gap-2.5 rounded-xl border p-3.5 text-xs animate-in fade-in ${
              alertInfo.type === "error"
                ? "border-red-500/20 bg-red-500/10 text-red-400"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {alertInfo.type === "error" ? (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{alertInfo.text}</span>
          </div>
        )}

        {/* 1. MODO LOGIN */}
        {step === "login" && (
          <form onSubmit={handleSubmitLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <Input
                  type="email"
                  placeholder="tu.correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-10.5 rounded-xl border-slate-800 bg-slate-950/70 pl-10 text-xs text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-slate-300">Contraseña</Label>
                <button
                  type="button"
                  onClick={() => {
                    setAlertInfo(null);
                    setStep("request_pin");
                  }}
                  className="text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10.5 rounded-xl border-slate-800 bg-slate-950/70 pl-10 pr-10 text-xs text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || googleLoading}
              className="h-11 w-full gap-2 rounded-xl bg-blue-600 text-xs font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 active:scale-[0.99] transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Iniciando...</span>
                </>
              ) : (
                <>
                  <span>Iniciar Sesión</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <div className="relative my-5 flex items-center justify-center text-[11px]">
              <div className="w-full border-t border-slate-800" />
              <span className="bg-slate-900/90 px-3 text-slate-500">O ingresa con</span>
              <div className="w-full border-t border-slate-800" />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleLogin}
              disabled={loading || googleLoading}
              className="h-11 w-full gap-2.5 rounded-xl border-slate-800 bg-slate-950/60 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              )}
              <span>Continuar con Google</span>
            </Button>

            <p className="mt-5 text-center text-xs text-slate-400">
              ¿No tienes una cuenta?{" "}
              <Link href="/register" className="font-semibold text-blue-400 hover:text-blue-300">
                Regístrate gratis
              </Link>
            </p>
          </form>
        )}

        {/* 2. MODO PEDIR CORREO */}
        {step === "request_pin" && (
          <form onSubmit={handleRequestPin} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <Input
                  type="email"
                  placeholder="tu.correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-10.5 rounded-xl border-slate-800 bg-slate-950/70 pl-10 text-xs text-slate-100 focus:border-blue-500"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="h-11 w-full gap-2 rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-500 cursor-pointer">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Enviar Código</span><ArrowRight className="h-4 w-4" /></>}
            </Button>

            <Button type="button" variant="ghost" onClick={() => setStep("login")} className="w-full text-xs text-slate-400 hover:text-slate-200 cursor-pointer">
              Volver
            </Button>
          </form>
        )}

        {/* 3. MODO INGRESAR PIN */}
        {step === "enter_pin" && (
          <form onSubmit={handleVerifyPinOnly} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Código PIN de 6 dígitos</Label>
              <div className="relative">
                <ShieldCheck className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ""))}
                  required
                  className="h-12 text-center font-mono tracking-[0.4em] text-xl font-bold rounded-xl border-slate-800 bg-slate-950/70 text-blue-400"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="h-11 w-full gap-2 rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-500 cursor-pointer">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Validar Código</span><ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>
        )}

        {/* 4. MODO NUEVA CONTRASEÑA */}
        {step === "new_password" && (
          <form onSubmit={handleSaveNewPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Nueva Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="h-10.5 rounded-xl border-slate-800 bg-slate-950/70 pl-10 pr-10 text-xs text-slate-100"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="h-11 w-full gap-2 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Guardar y Entrar</span>}
            </Button>
          </form>
        )}

        {/* 5. MODO CONFIGURAR NOMBRE Y CONTRASEÑA PARA NUEVOS USUARIOS DE GOOGLE */}
        {step === "google_new_user" && (
          <form onSubmit={handleSaveGoogleNewUser} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label className="text-slate-300 font-bold flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-cyan-400" /> Nombre de Usuario
              </Label>
              <Input
                type="text"
                required
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Ej. Jaime Montiel"
                className="h-11 rounded-xl border-slate-800 bg-slate-950/70 text-slate-100 text-xs px-4"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300 font-bold flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-blue-400" /> Crear Contraseña
              </Label>
              <Input
                type="password"
                required
                minLength={6}
                value={googlePassword}
                onChange={(e) => setGooglePassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="h-11 rounded-xl border-slate-800 bg-slate-950/70 text-slate-100 text-xs px-4 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300 font-bold flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-blue-400" /> Confirmar Contraseña
              </Label>
              <Input
                type="password"
                required
                minLength={6}
                value={confirmGooglePassword}
                onChange={(e) => setConfirmGooglePassword(e.target.value)}
                placeholder="Repite la contraseña"
                className="h-11 rounded-xl border-slate-800 bg-slate-950/70 text-slate-100 text-xs px-4 font-mono"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 font-bold text-xs text-white shadow-lg shadow-blue-600/25 hover:brightness-110 transition-all mt-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Guardar y Entrar</span>
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}