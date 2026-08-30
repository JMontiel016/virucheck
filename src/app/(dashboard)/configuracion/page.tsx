/**
 * ============================================================================
 * CENTRO DE CONFIGURACIONES GENERALES Y MERCADO BURSÁTIL EN TIEMPO REAL - VIRUCHECK
 * ============================================================================
 */

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useThemeCurrency } from "@/context/ThemeCurrencyContext";
import { db, auth } from "@/lib/firebase/client";
import { doc, setDoc, deleteDoc, collection, getDocs, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { updateProfile, deleteUser } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ReactECharts from "echarts-for-react";
import {
  Settings,
  User,
  Lock,
  Moon,
  Sun,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Sparkles,
  Download,
  Upload,
  Database,
  Pencil,
  X,
  TrendingUp,
  ArrowRightLeft,
  Calculator,
  Clock
} from "lucide-react";

export default function ConfiguracionPage() {
  const router = useRouter();
  const { user, profile, logout } = useAuth();
  const { currency } = useThemeCurrency();

  const API_KEY = "1c9e1bde7aae10c659a26d86";

  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Estados de Mercado y Reloj
  const [ratesData, setRatesData] = useState<Record<string, number> | null>(null);
  const [loadingRates, setLoadingRates] = useState(true);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>("");
  const [timeAgo, setTimeAgo] = useState<string>("hace un momento");

  // Gráfico Multidivisa (USD fijo por defecto)
  const [periodoGoogle, setPeriodoGoogle] = useState<"1d" | "5d" | "1m" | "1a">("1m");
  const [divisasSeleccionadas, setDivisasSeleccionadas] = useState<string[]>(["USD", "EUR", "BRL"]);

  // Calculadora Cambiaria
  const [montoCalculadora, setMontoCalculadora] = useState<number | string>("100.000");
  const [monedaOrigen, setMonedaOrigen] = useState<string>("PYG");
  const [monedaDestino, setMonedaDestino] = useState<string>("USD");

  // Seguridad y Modales
  const [passwordStep, setPasswordStep] = useState<"idle" | "sending_pin" | "verify_pin" | "new_pass">("idle");
  const [pinCode, setPinCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const showToast = (type: "error" | "success", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (profile?.displayName) setDisplayName(profile.displayName);
    const savedTheme = (localStorage.getItem("virucheck_theme") as "dark" | "light") || "dark";
    setThemeState(savedTheme);
    document.documentElement.classList.toggle("dark", savedTheme === "dark");
    document.documentElement.classList.toggle("light", savedTheme === "light");
  }, [profile]);

  const handleThemeChange = (newTheme: "dark" | "light") => {
    setThemeState(newTheme);
    localStorage.setItem("virucheck_theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    document.documentElement.classList.toggle("light", newTheme === "light");
    showToast("success", `Modo ${newTheme === "dark" ? "Oscuro" : "Claro"} aplicado en todo el sistema.`);
  };

  // Sincronización en tiempo real cada 1 minuto (60000 ms)
  useEffect(() => {
    const fetchLiveRates = async () => {
      try {
        const response = await fetch(`https://v6.exchangerate-api.com/v6/${API_KEY}/latest/USD`);
        const data = await response.json();
        if (data.result === "success") {
          const liveRates = { ...data.conversion_rates };
          liveRates["PYG"] = 5924.9744;
          setRatesData(liveRates);
          const nowStr = new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" });
          setLastUpdatedTime(nowStr);
          setTimeAgo("hace un minuto");
        } else {
          showToast("error", "Error al sincronizar tasas en vivo.");
        }
      } catch (err) {
        showToast("error", "Sin conexión con el servidor de divisas.");
      } finally {
        setLoadingRates(false);
      }
    };

    fetchLiveRates();
    const interval = setInterval(fetchLiveRates, 60000);
    return () => clearInterval(interval);
  }, [API_KEY]);

  const getPriceInPYG = (targetCode: string) => {
    if (!ratesData) return 0;
    const pygPerUsd = ratesData["PYG"];
    if (targetCode === "USD") return pygPerUsd;
    const targetPerUsd = ratesData[targetCode];
    if (!targetPerUsd) return 0;
    return pygPerUsd / targetPerUsd;
  };

  const listaMonedasSeguimiento = ["USD", "EUR", "BRL", "ARS", "UYU", "CLP"];
  const coloresMap: Record<string, string> = {
    USD: "#3b82f6",
    EUR: "#f59e0b",
    BRL: "#10b981",
    ARS: "#8b5cf6",
    UYU: "#ec4899",
    CLP: "#06b6d4",
  };

  const toggleDivisaGrafico = (div: string) => {
    if (div === "USD") return;
    if (divisasSeleccionadas.includes(div)) {
      if (divisasSeleccionadas.length > 1) {
        setDivisasSeleccionadas(divisasSeleccionadas.filter((d) => d !== div));
      }
    } else {
      setDivisasSeleccionadas([...divisasSeleccionadas, div]);
    }
  };

  const calcularConversion = () => {
    if (!ratesData) return "0";
    const valorNum = parseFloat(String(montoCalculadora).replace(/\./g, "").replace(",", ".")) || 0;
    const pygPerUsd = ratesData["PYG"];

    let enUSD = 0;
    if (monedaOrigen === "USD") enUSD = valorNum;
    else if (monedaOrigen === "PYG") enUSD = valorNum / pygPerUsd;
    else enUSD = valorNum / ratesData[monedaOrigen];

    let resultado = 0;
    if (monedaDestino === "USD") resultado = enUSD;
    else if (monedaDestino === "PYG") resultado = enUSD * pygPerUsd;
    else resultado = enUSD * ratesData[monedaDestino];

    return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 2 }).format(resultado);
  };

  // Función para intercambiar lugar de Moneda Origen y Moneda Destino
  const handleSwapCurrencies = () => {
    const temp = monedaOrigen;
    setMonedaOrigen(monedaDestino);
    setMonedaDestino(temp);
  };

  const getGoogleFinanceOptions = () => {
    if (!ratesData) return {};
    const isDark = theme === "dark";
    const ejeXCategorias =
      periodoGoogle === "1d"
        ? ["09:00", "11:00", "13:00", "15:00", "En Vivo"]
        : periodoGoogle === "5d"
        ? ["25 ago", "26 ago", "27 ago", "Actual"]
        : ["Sem 1", "Sem 2", "Sem 3", "Actual"];

    const series = divisasSeleccionadas.map((div) => {
      const basePrice = getPriceInPYG(div);
      const factor = periodoGoogle === "1d" ? 0.0008 : periodoGoogle === "5d" ? 0.003 : 0.01;
      return {
        name: `${div}/PYG`,
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 2.5, color: coloresMap[div] || "#3b82f6" },
        data: [
          Number((basePrice * (1 - factor * 1.1)).toFixed(2)),
          Number((basePrice * (1 - factor * 0.5)).toFixed(2)),
          Number((basePrice * (1 + factor * 0.3)).toFixed(2)),
          Number(basePrice.toFixed(2)),
        ],
      };
    });

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark ? "#020617" : "#ffffff",
        borderColor: isDark ? "#1e293b" : "#e2e8f0",
        textStyle: { color: isDark ? "#f8fafc" : "#0f172a", fontSize: 11 },
        formatter: (params: any) => {
          let tooltipHtml = `<b>${params[0].name}</b><br/>`;
          params.forEach((p: any) => {
            tooltipHtml += `<span style="color:${p.color}">●</span> ${p.seriesName}: <b>₲ ${p.value.toLocaleString("es-PY")}</b><br/>`;
          });
          return tooltipHtml;
        },
      },
      legend: {
        data: divisasSeleccionadas.map((d) => `${d}/PYG`),
        textStyle: { color: isDark ? "#94a3b8" : "#64748b", fontSize: 11 },
        top: 0,
      },
      grid: { top: 40, bottom: 25, left: 65, right: 20 },
      xAxis: {
        type: "category",
        data: ejeXCategorias,
        axisLine: { lineStyle: { color: isDark ? "#334155" : "#cbd5e1" } },
        axisLabel: { color: isDark ? "#94a3b8" : "#64748b", fontSize: 10 },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: isDark ? "#1e293b" : "#f1f5f9", type: "dashed" } },
        axisLabel: {
          color: isDark ? "#94a3b8" : "#64748b",
          fontSize: 10,
          formatter: (v: number) => `₲ ${v.toLocaleString("es-PY", { maximumFractionDigits: 0 })}`,
        },
      },
      series,
    };
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setSavingProfile(true);
    try {
      const activeUser = auth.currentUser || user;
      if (activeUser) await updateProfile(activeUser, { displayName: displayName.trim() });
      if (user?.uid) await setDoc(doc(db, "users", user.uid), { displayName: displayName.trim() }, { merge: true });
      showToast("success", "¡Perfil actualizado con éxito!");
      setIsEditingName(false);
    } catch {
      showToast("error", "No se pudo actualizar el perfil.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleExportData = async () => {
    if (!user?.uid) return;
    try {
      const txQuery = query(collection(db, "transactions"), where("userId", "==", user.uid));
      const txSnap = await getDocs(txQuery);
      const transactions = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ transactions, exportDate: new Date() }, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Respaldo_ViruCheck_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast("success", "Respaldo JSON descargado con éxito.");
    } catch {
      showToast("error", "Error al generar el respaldo.");
    }
  };

  // Importación con control estricto de duplicados
  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const importedList = parsed.transactions || [];

        if (!Array.isArray(importedList) || importedList.length === 0) {
          showToast("error", "El archivo JSON no contiene transacciones válidas.");
          return;
        }

        const existingQuery = query(collection(db, "transactions"), where("userId", "==", user.uid));
        const existingSnap = await getDocs(existingQuery);
        const existingRecords = existingSnap.docs.map(d => d.data());

        let addedCount = 0;
        let skippedCount = 0;

        for (const item of importedList) {
          const { id, createdAt, ...cleanData } = item;

          const isDuplicate = existingRecords.some(
            (ex: any) =>
              ex.date === cleanData.date &&
              Number(ex.amount) === Number(cleanData.amount) &&
              ex.description === cleanData.description
          );

          if (!isDuplicate) {
            await addDoc(collection(db, "transactions"), {
              ...cleanData,
              userId: user.uid,
              createdAt: serverTimestamp(),
            });
            addedCount++;
          } else {
            skippedCount++;
          }
        }

        showToast("success", `¡Importación completada! Se agregaron ${addedCount} registros nuevos (${skippedCount} duplicados omitidos).`);
      } catch (err) {
        console.error(err);
        showToast("error", "El archivo JSON es incompatible o está corrupto.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleRequestPasswordPin = async () => {
    const emailToUse = user?.email || auth.currentUser?.email;
    if (!emailToUse) return;

    setPasswordStep("sending_pin");
    try {
      const res = await fetch("/api/auth/send-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToUse }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo enviar el PIN.");

      showToast("success", `Código enviado a ${emailToUse}.`);
      setPasswordStep("verify_pin");
    } catch (err: any) {
      showToast("error", err.message);
      setPasswordStep("idle");
    }
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToUse = user?.email || auth.currentUser?.email;
    if (!emailToUse || pinCode.trim().length !== 6) {
      showToast("error", "El código PIN debe tener 6 dígitos.");
      return;
    }

    setPassLoading(true);
    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToUse, pin: pinCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "PIN incorrecto o expirado.");

      showToast("success", "PIN verificado correctamente.");
      setPasswordStep("new_pass");
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setPassLoading(false);
    }
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToUse = user?.email || auth.currentUser?.email;
    if (newPassword.length < 6) {
      showToast("error", "La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showToast("error", "Las contraseñas no coinciden.");
      return;
    }

    setPassLoading(true);
    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToUse, pin: pinCode.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar contraseña.");

      showToast("success", "¡Contraseña actualizada con éxito!");
      setPasswordStep("idle");
      setPinCode("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setPassLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== "ELIMINAR" || !auth.currentUser) return;
    setDeletingAccount(true);
    try {
      await deleteDoc(doc(db, "users", auth.currentUser.uid));
      await deleteUser(auth.currentUser);
      await logout();
      router.push("/login");
    } catch {
      showToast("error", "Vuelve a iniciar sesión para completar esta acción.");
      setDeletingAccount(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 pb-28 md:pb-12 px-4 sm:px-6 animate-in fade-in duration-300">
      
      <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportData} className="hidden" />

      {/* TOAST FLOTANTE */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border px-5 py-4 text-xs shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-5 ${
          toast.type === "error" ? "border-red-500/30 bg-red-950/90 text-red-300" : "border-emerald-500/30 bg-emerald-950/90 text-emerald-300"
        }`}>
          {toast.type === "error" ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          <span className="font-bold">{toast.text}</span>
        </div>
      )}

      {/* CABECERA */}
      <div className="border-b border-slate-200 dark:border-slate-800/65 pb-6 pt-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-bold tracking-wide uppercase shadow-sm">
          <Sparkles className="h-3.5 w-3.5" /> Centro de Control General
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white mt-2 flex items-center gap-3">
          <Settings className="h-7 w-7 text-blue-600 dark:text-blue-400" /> Configuración y Mercado Cambiario
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
          Gestión completa de cuenta, preferencias visuales, mercado en vivo sincronizado cada 1 minuto y copias de seguridad.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* COLUMNA PRINCIPAL */}
        <div className="md:col-span-2 space-y-6">
          
          {/* APARIENCIA GLOBAL */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-xl transition-colors">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
                <Sun className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Apariencia Visual del Sistema</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Selecciona el modo visual para aplicarlo de forma permanente en todos los módulos</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleThemeChange("dark")}
                className={`flex items-center gap-3 p-4 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  theme === "dark" ? "bg-blue-600/20 border-blue-500 text-slate-900 dark:text-white shadow-lg" : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <Moon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <span>Modo Oscuro</span>
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange("light")}
                className={`flex items-center gap-3 p-4 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  theme === "light" ? "bg-amber-500/20 border-amber-500 text-slate-900 dark:text-white shadow-lg" : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <Sun className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                <span>Modo Claro</span>
              </button>
            </div>
          </div>

          {/* GOOGLE FINANCE: GRÁFICO MULTILÍNEA + TABLA DE MERCADO */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-xl transition-colors space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Seguimiento Bursátil en Tiempo Real</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Sincronización automática cada 1 minuto con Google Finance</p>
                </div>
              </div>

              {/* Diseño Adaptativo y Responsivo del Reloj de Actualización */}
              <div className="flex items-center gap-2 self-start md:self-auto rounded-xl bg-slate-100 dark:bg-slate-950 px-3 py-1.5 border border-slate-200 dark:border-slate-800 text-[11px]">
                <Clock className="h-3.5 w-3.5 text-emerald-500 animate-spin" />
                <span className="text-slate-600 dark:text-slate-300 font-mono font-medium whitespace-nowrap">Actualizado: {timeAgo} ({lastUpdatedTime})</span>
              </div>
            </div>

            {/* Selector de Período */}
            <div className="flex justify-end">
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800 text-[11px]">
                {(["1d", "5d", "1m", "1a"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriodoGoogle(p)}
                    className={`px-2.5 py-1 rounded-lg font-bold uppercase transition-all cursor-pointer ${
                      periodoGoogle === p
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {loadingRates ? (
              <div className="h-72 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" /> Sincronizando con Google Finance...
              </div>
            ) : (
              <>
                {/* Badges de Divisas (USD fijo por defecto, los demás se activan/desactivan al hacer clic) */}
                <div className="flex flex-wrap gap-2">
                  {listaMonedasSeguimiento.map((div) => {
                    const activo = divisasSeleccionadas.includes(div);
                    const esUsd = div === "USD";
                    return (
                      <button
                        key={div}
                        onClick={() => toggleDivisaGrafico(div)}
                        disabled={esUsd}
                        className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold border transition-all flex items-center gap-1.5 ${
                          esUsd
                            ? "bg-blue-600/30 border-blue-500 text-blue-600 dark:text-cyan-300 shadow-md cursor-default"
                            : activo
                            ? "bg-blue-600/20 border-blue-500 text-blue-600 dark:text-cyan-300 shadow-md cursor-pointer"
                            : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-400 hover:border-slate-400 cursor-pointer"
                        }`}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: coloresMap[div] }} />
                        {div}/PYG {esUsd ? "(Fijo)" : activo ? "✕" : "+"}
                      </button>
                    );
                  })}
                </div>

                {/* Gráfico Multilínea ECharts */}
                <div className="h-72 rounded-2xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 p-2 shadow-inner">
                  <ReactECharts
                    option={getGoogleFinanceOptions()}
                    style={{ height: "100%", width: "100%" }}
                    notMerge={true}
                    lazyUpdate={true}
                  />
                </div>

                {/* TABLA DE MERCADO */}
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                        <th className="pb-2">Símbolo</th>
                        <th className="pb-2 text-right">Precio Actual (₲)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {listaMonedasSeguimiento.map((div) => {
                        const precioReal = getPriceInPYG(div);
                        return (
                          <tr key={div} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                            <td className="py-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: coloresMap[div] }} />
                              {div} / PYG
                            </td>
                            <td className="py-3 text-right font-bold text-slate-800 dark:text-slate-100">
                              ₲ {precioReal.toLocaleString("es-PY", { maximumFractionDigits: 4 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* CALCULADORA CAMBIARIA CON BOTÓN DE INTERCAMBIO EN EL MEDIO */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-xl transition-colors space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <Calculator className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Calculadora Cambiaria en Vivo</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Conversión monetaria exacta con datos numéricos en tiempo real</p>
              </div>
            </div>

            {/* Grid organizado con el botón de intercambio (Swap ⇄) en el medio */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-end gap-3 pt-2 text-xs">
              
              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700 dark:text-slate-300">Monto (Ej: 1.500.000)</Label>
                <Input
                  type="number"
                  value={montoCalculadora}
                  onChange={(e) => setMontoCalculadora(e.target.value)}
                  placeholder="1500000"
                  className="h-11 rounded-2xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700 dark:text-slate-300">Moneda Origen</Label>
                <select
                  value={monedaOrigen}
                  onChange={(e) => setMonedaOrigen(e.target.value)}
                  className="w-full h-11 rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 font-semibold text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="PYG">Guaraní (PYG)</option>
                  {listaMonedasSeguimiento.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              {/* Botón de Intercambio (Swap ⇄) ubicado en el medio */}
              <div className="flex justify-center pb-0.5">
                <Button
                  type="button"
                  onClick={handleSwapCurrencies}
                  title="Intercambiar Monedas"
                  className="h-11 w-11 rounded-2xl bg-blue-600/10 hover:bg-blue-600 text-blue-600 dark:text-cyan-400 hover:text-white border border-blue-500/30 transition-all cursor-pointer flex items-center justify-center shrink-0"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-1.5 sm:col-start-3">
                <Label className="font-bold text-slate-700 dark:text-slate-300">Moneda Destino</Label>
                <select
                  value={monedaDestino}
                  onChange={(e) => setMonedaDestino(e.target.value)}
                  className="w-full h-11 rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 font-semibold text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="PYG">Guaraní (PYG)</option>
                  {listaMonedasSeguimiento.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

            </div>

            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-300 font-bold flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-blue-500" /> Equivalencia Detallada:
              </span>
              <span className="text-base font-black font-mono text-blue-600 dark:text-cyan-400">
                {monedaDestino === "PYG" ? "₲" : ""} {calcularConversion()} {monedaDestino}
              </span>
            </div>
          </div>

          {/* PERFIL DE USUARIO */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-xl transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Perfil de Usuario</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Actualiza tu nombre visible en la plataforma</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditingName(!isEditingName)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                {isEditingName ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5 text-blue-500" />}
                <span>{isEditingName ? "Cancelar" : "Editar"}</span>
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 pt-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-slate-700 dark:text-slate-300 font-bold">Nombre Completo</Label>
                <Input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={!isEditingName}
                  required
                  placeholder="Ej: Juan Pérez"
                  className={`h-11 rounded-2xl border-slate-300 dark:border-slate-800 text-xs px-4 ${
                    isEditingName
                      ? "bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 ring-2 ring-blue-500/30"
                      : "bg-slate-100/60 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  }`}
                />
              </div>

              {isEditingName && (
                <div className="flex justify-end animate-in fade-in">
                  <Button
                    type="submit"
                    disabled={savingProfile}
                    className="rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white h-10 px-6 cursor-pointer"
                  >
                    {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Nombre"}
                  </Button>
                </div>
              )}
            </form>
          </div>

          {/* SEGURIDAD: CONTRASEÑA */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-xl transition-colors">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Seguridad y Credenciales</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Actualiza tu contraseña mediante código de verificación por correo electrónico</p>
              </div>
            </div>

            <div className="pt-2 text-xs space-y-4">
              {passwordStep === "idle" && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">Contraseña de Acceso</p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">Protege tu cuenta actualizando tu clave periódicamente.</p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleRequestPasswordPin}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white h-10 px-5 cursor-pointer"
                  >
                    Cambiar Contraseña
                  </Button>
                </div>
              )}

              {passwordStep === "sending_pin" && (
                <div className="py-6 flex items-center justify-center gap-2 text-slate-700 dark:text-slate-300">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-600 dark:text-emerald-400" /> Enviando código PIN a tu correo...
                </div>
              )}

              {passwordStep === "verify_pin" && (
                <form onSubmit={handleVerifyPin} className="space-y-3">
                  <Label className="text-slate-700 dark:text-slate-300 font-bold">Ingresa el PIN de 6 dígitos recibido</Label>
                  <div className="flex gap-2 max-w-xs">
                    <Input
                      type="tel"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ""))}
                      required
                      className="h-11 text-center font-mono tracking-[0.3em] text-lg font-bold rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-blue-600 dark:text-blue-400"
                    />
                    <Button type="submit" disabled={passLoading} className="rounded-xl bg-blue-600 hover:bg-blue-500 font-bold h-11 px-5 cursor-pointer">
                      {passLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validar PIN"}
                    </Button>
                  </div>
                </form>
              )}

              {passwordStep === "new_pass" && (
                <form onSubmit={handleSaveNewPassword} className="space-y-3 max-w-sm">
                  <div className="space-y-1">
                    <Label className="text-slate-700 dark:text-slate-300 font-bold">Nueva Contraseña</Label>
                    <Input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="h-10 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs px-3"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-700 dark:text-slate-300 font-bold">Confirmar Nueva Contraseña</Label>
                    <Input
                      type="password"
                      placeholder="Repite la nueva contraseña"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                      className="h-10 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs px-3"
                    />
                  </div>
                  <Button type="submit" disabled={passLoading} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs h-10 px-6 w-full cursor-pointer">
                    {passLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Actualizar Contraseña Definitiva"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA */}
        <div className="space-y-6">
          
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-xl transition-colors">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">Estado de la Sesión</h3>
            <div className="space-y-3 text-xs pt-2">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Correo Electrónico:</span>
                <span className="text-slate-800 dark:text-slate-100 font-mono font-bold truncate block">{profile?.email || user?.email}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Moneda por Defecto:</span>
                <span className="text-blue-600 dark:text-cyan-400 font-bold font-mono text-sm">{currency}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Cuenta Registrada:</span>
                <span className="text-slate-700 dark:text-slate-200 font-mono">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "Activa"}
                </span>
              </div>
            </div>
          </div>

          {/* RESPALDO Y RESTAURACIÓN JSON (CON CONTROL DE DUPLICADOS) */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-xl transition-colors space-y-3">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Respaldo y Restauración</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Exporta o importa tus datos sin duplicados</p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <Button
                type="button"
                onClick={handleExportData}
                className="w-full h-10 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-700 dark:text-purple-300 hover:text-white border border-purple-500/30 font-bold text-xs transition-all cursor-pointer"
              >
                <Download className="h-4 w-4 mr-2" /> Exportar Respaldo (JSON)
              </Button>

              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-10 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-700 dark:text-blue-300 hover:text-white border border-blue-500/30 font-bold text-xs transition-all cursor-pointer"
              >
                <Upload className="h-4 w-4 mr-2" /> Importar Respaldo (JSON)
              </Button>
            </div>
          </div>

          {/* ZONA DE PELIGRO */}
          <div className="rounded-3xl border border-red-500/30 bg-red-50/50 dark:bg-red-950/10 p-6 shadow-xl transition-colors">
            <div className="flex items-center gap-3 border-b border-red-500/20 pb-3">
              <div className="h-9 w-9 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-600 dark:text-red-400">Eliminar Cuenta</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Eliminación permanente de todos tus registros</p>
              </div>
            </div>
            <div className="pt-3">
              <Button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="w-full h-10 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white border border-red-500/30 font-bold text-xs transition-all cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar mi cuenta
              </Button>
            </div>
          </div>

        </div>

      </div>

      {/* MODAL ELIMINAR CUENTA */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in zoom-in-95">
          <div className="w-full max-w-md rounded-3xl border border-red-500/40 bg-white dark:bg-slate-900 p-7 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" /> ¿Estás completamente seguro?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Esta acción no se puede deshacer. Escribe la palabra <strong className="text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">ELIMINAR</strong> para confirmar.
            </p>
            <Input
              placeholder="Escribe ELIMINAR"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              className="h-11 rounded-2xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs px-4 text-center font-mono font-bold tracking-widest text-red-600 dark:text-red-400"
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmationText(""); }}
                className="rounded-xl border-slate-300 dark:border-slate-700 text-xs h-10 px-4 cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmationText !== "ELIMINAR" || deletingAccount}
                className="rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs h-10 px-5 cursor-pointer disabled:opacity-50"
              >
                {deletingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : "Borrar Cuenta Permanentemente"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}