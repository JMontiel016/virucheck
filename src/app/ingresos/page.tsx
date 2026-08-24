"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  saveIncomeProfile,
  getIncomeProfile,
  addAdditionalIncome,
  getAdditionalIncomes,
  deleteAdditionalIncome,
} from "@/lib/firebase/salaryService";
import { IncomeProfile, AdditionalIncome, WorkerType } from "@/types/income";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Briefcase,
  UserCheck,
  TrendingUp,
  ShieldCheck,
  PlusCircle,
  Trash2,
  Calendar,
  DollarSign,
  ArrowUpRight,
  PieChart as PieChartIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Receipt,
} from "lucide-react";

export default function IngresosPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Estados del Perfil Salarial
  const [workerType, setWorkerType] = useState<WorkerType>("dependent");
  const [grossAmount, setGrossAmount] = useState<number>(0);
  const [hasIps, setHasIps] = useState<boolean>(true);
  const [appliesIva, setAppliesIva] = useState<boolean>(false);
  const [payDay, setPayDay] = useState<number>(30);

  // Estados de Ingresos Adicionales
  const [extraIncomes, setExtraIncomes] = useState<AdditionalIncome[]>([]);
  const [newExtraTitle, setNewExtraTitle] = useState("");
  const [newExtraAmount, setNewExtraAmount] = useState<number>(0);
  const [newExtraCategory, setNewExtraCategory] = useState<AdditionalIncome["category"]>("freelance");
  const [newExtraDate, setNewExtraDate] = useState(new Date().toISOString().split("T")[0]);

  // Cálculos Automáticos
  const ipsDeduction = workerType === "dependent" && hasIps ? Math.round(grossAmount * 0.09) : 0;
  const ivaDeduction = workerType === "independent" && appliesIva ? Math.round(grossAmount / 11) : 0;
  const netBase = grossAmount - ipsDeduction - (workerType === "independent" && appliesIva ? ivaDeduction : 0);
  const totalExtras = extraIncomes.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalNetLiquidity = netBase + totalExtras;

  useEffect(() => {
    if (!user?.uid) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [profile, extras] = await Promise.all([
        getIncomeProfile(user!.uid),
        getAdditionalIncomes(user!.uid),
      ]);

      if (profile) {
        setWorkerType(profile.workerType || "dependent");
        setGrossAmount(profile.grossAmount || 0);
        setHasIps(profile.hasIps ?? true);
        setAppliesIva(profile.appliesIva ?? false);
        setPayDay(profile.payDay || 30);
      }
      setExtraIncomes(extras);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    setSaving(true);
    setAlert(null);

    try {
      await saveIncomeProfile(user.uid, {
        workerType,
        grossAmount,
        hasIps: workerType === "dependent" ? hasIps : false,
        ipsRate: workerType === "dependent" && hasIps ? 0.09 : 0,
        ipsDeduction,
        appliesIva: workerType === "independent" ? appliesIva : false,
        ivaAmount: ivaDeduction,
        netLiquidity: netBase,
        payDay,
        currency: "PYG",
      });

      setAlert({ type: "success", text: "Configuración salarial actualizada correctamente." });
    } catch (err: any) {
      setAlert({ type: "error", text: err.message || "Error al guardar los cambios." });
    } finally {
      setSaving(false);
    }
  };

  const handleAddExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !newExtraTitle.trim() || newExtraAmount <= 0) return;

    try {
      await addAdditionalIncome(user.uid, {
        title: newExtraTitle.trim(),
        amount: newExtraAmount,
        category: newExtraCategory,
        date: newExtraDate,
      });

      setNewExtraTitle("");
      setNewExtraAmount(0);
      loadData();
    } catch (err: any) {
      setAlert({ type: "error", text: "No se pudo registrar el ingreso extra." });
    }
  };

  const handleDeleteExtra = async (id?: string) => {
    if (!id) return;
    try {
      await deleteAdditionalIncome(id);
      setExtraIncomes((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const formatPYG = (val: number) => {
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: "PYG",
      maximumFractionDigits: 0,
    })
      .format(val)
      .replace("PYG", "Gs.");
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8 animate-in fade-in duration-300">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-emerald-400" />
            Gestión de Salarios e Ingresos
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configura tu régimen laboral, cálculo de IPS/IVA y controla tu liquidez neta real.
          </p>
        </div>
      </div>

      {alert && (
        <div
          className={`flex items-center gap-3 rounded-2xl border p-4 text-xs font-medium ${
            alert.type === "error"
              ? "border-red-500/20 bg-red-500/10 text-red-400"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {alert.type === "error" ? <AlertCircle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
          <span>{alert.text}</span>
        </div>
      )}

      {/* DASHBOARD CARDS RESUMEN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Tarjeta 1: Liquidez Total Neta */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 p-6 shadow-xl shadow-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">Liquidez Neta Total</span>
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 text-2xl sm:text-3xl font-black text-white">{formatPYG(totalNetLiquidity)}</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
            <span className="flex items-center text-emerald-400 font-medium">
              <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
              100% disponible
            </span>
            <span>para gastos y ahorros</span>
          </div>
        </div>

        {/* Tarjeta 2: Salario Base Neto */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Sueldo Base Neto</span>
            <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-400">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-bold text-slate-100">{formatPYG(netBase)}</p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
            <span>Bruto: {formatPYG(grossAmount)}</span>
            <span>Día {payDay} de cada mes</span>
          </div>
        </div>

        {/* Tarjeta 3: Deducciones Legales (IPS / IVA) */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Deducciones / Retenciones</span>
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-bold text-amber-400">{formatPYG(ipsDeduction + ivaDeduction)}</p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
            <span>{workerType === "dependent" ? "Aporte IPS Obrero (9%)" : "IVA Estimado (10%)"}</span>
            <span>{formatPYG(ipsDeduction || ivaDeduction)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* PANEL IZQUIERDO: CONFIGURACIÓN DEL PERFIL SALARIAL */}
        <div className="lg:col-span-7 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 backdrop-blur-xl shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Configuración del Salario Principal</h2>
              <p className="text-xs text-slate-400">Define tu modalidad de trabajo y deducciones legales.</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* SELECTOR DE RÉGIMEN LABORAL */}
            <div className="space-y-2">
              <Label className="text-xs text-slate-300 font-semibold uppercase tracking-wider">Modalidad Laboral</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setWorkerType("dependent");
                    setHasIps(true);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-all ${
                    workerType === "dependent"
                      ? "border-blue-500 bg-blue-600/15 text-white shadow-lg shadow-blue-500/10"
                      : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <Briefcase className="h-5 w-5" />
                  <span className="text-xs font-bold">Asalariado / Fijo</span>
                  <span className="text-[10px] text-slate-400">Contrato en dependencia</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWorkerType("independent");
                    setHasIps(false);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-all ${
                    workerType === "independent"
                      ? "border-cyan-500 bg-cyan-600/15 text-white shadow-lg shadow-cyan-500/10"
                      : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <Receipt className="h-5 w-5" />
                  <span className="text-xs font-bold">Prestador de Servicios</span>
                  <span className="text-[10px] text-slate-400">Facturación independiente</span>
                </button>
              </div>
            </div>

            {/* MONTO BRUTO */}
            <div className="space-y-2">
              <Label className="text-xs text-slate-300 font-medium">
                {workerType === "dependent" ? "Salario Bruto Acordado (Gs.)" : "Facturación Bruta Mensual (Gs.)"}
              </Label>
              <Input
                type="number"
                min="0"
                step="10000"
                value={grossAmount || ""}
                onChange={(e) => setGrossAmount(Number(e.target.value))}
                placeholder="Ej: 3500000"
                className="h-11 rounded-xl border-slate-800 bg-slate-950/70 text-slate-100 text-sm font-semibold focus:border-blue-500"
                required
              />
            </div>

            {/* OPCIONES ESPECÍFICAS SEGÚN RÉGIMEN */}
            {workerType === "dependent" ? (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      Aporte Obrero IPS (9%)
                    </Label>
                    <p className="text-[11px] text-slate-400">Descuenta automáticamente el 9% legal sobre el monto bruto.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasIps}
                    onChange={(e) => setHasIps(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                {hasIps && (
                  <div className="flex justify-between items-center text-xs text-slate-300 border-t border-slate-800 pt-2 font-mono">
                    <span>Descuento estimado:</span>
                    <span className="text-amber-400 font-bold">-{formatPYG(ipsDeduction)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-white flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-cyan-400" />
                      Separar IVA (10%)
                    </Label>
                    <p className="text-[11px] text-slate-400">Calcula la porción de débito fiscal para no contarla como ganancia neta.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={appliesIva}
                    onChange={(e) => setAppliesIva(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-cyan-500"
                  />
                </div>
                {appliesIva && (
                  <div className="flex justify-between items-center text-xs text-slate-300 border-t border-slate-800 pt-2 font-mono">
                    <span>IVA a reservar:</span>
                    <span className="text-amber-400 font-bold">-{formatPYG(ivaDeduction)}</span>
                  </div>
                )}
              </div>
            )}

            {/* DÍA DE PAGO */}
            <div className="space-y-2">
              <Label className="text-xs text-slate-300 font-medium">Día de cobro habitual</Label>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-slate-500" />
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={payDay}
                  onChange={(e) => setPayDay(Number(e.target.value))}
                  className="h-11 w-32 rounded-xl border-slate-800 bg-slate-950/70 text-slate-100 text-sm font-semibold focus:border-blue-500"
                  required
                />
                <span className="text-xs text-slate-400">de cada mes</span>
              </div>
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="h-11 w-full gap-2 rounded-xl bg-blue-600 font-bold text-xs text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Perfil Salarial"}
            </Button>
          </form>
        </div>

        {/* PANEL DERECHO: INGRESOS ADICIONALES (EXTRAS / FREELANCE / BONOS) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-xl shadow-xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-400 border border-emerald-500/20">
                <PlusCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Registrar Ingreso Extra</h3>
                <p className="text-xs text-slate-400">Bonos, comisiones, horas extras o freelance.</p>
              </div>
            </div>

            <form onSubmit={handleAddExtra} className="space-y-3">
              <Input
                type="text"
                placeholder="Descripción (ej. Proyecto Web, Bono)"
                value={newExtraTitle}
                onChange={(e) => setNewExtraTitle(e.target.value)}
                required
                className="h-10 rounded-xl border-slate-800 bg-slate-950/70 text-xs text-slate-100 placeholder:text-slate-600 focus:border-emerald-500"
              />

              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min="0"
                  step="5000"
                  placeholder="Monto (Gs.)"
                  value={newExtraAmount || ""}
                  onChange={(e) => setNewExtraAmount(Number(e.target.value))}
                  required
                  className="h-10 rounded-xl border-slate-800 bg-slate-950/70 text-xs text-slate-100 placeholder:text-slate-600 focus:border-emerald-500"
                />

                <select
                  value={newExtraCategory}
                  onChange={(e) => setNewExtraCategory(e.target.value as any)}
                  className="h-10 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-200 px-3 focus:border-emerald-500 outline-none"
                >
                  <option value="freelance">Freelance</option>
                  <option value="bonus">Bono / Premio</option>
                  <option value="overtime">Horas Extras</option>
                  <option value="aguinaldo">Aguinaldo</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <Input
                type="date"
                value={newExtraDate}
                onChange={(e) => setNewExtraDate(e.target.value)}
                className="h-10 rounded-xl border-slate-800 bg-slate-950 text-xs text-slate-200 focus:border-emerald-500"
              />

              <Button
                type="submit"
                className="h-10 w-full gap-2 rounded-xl bg-emerald-600 font-bold text-xs text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
              >
                Agregar Ingreso
              </Button>
            </form>
          </div>

          {/* LISTA DE INGRESOS EXTRAS REGISTRADOS */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-xl space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Historial de Ingresos Extras</h4>
            {extraIncomes.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No hay ingresos adicionales registrados este mes.</p>
            ) : (
              <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                {extraIncomes.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-100">{item.title}</p>
                      <span className="text-[10px] text-slate-400">{item.date}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-400 font-mono">+{formatPYG(item.amount)}</span>
                      <button
                        onClick={() => handleDeleteExtra(item.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}