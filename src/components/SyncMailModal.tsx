import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, KeyRound, Loader2, Sparkles, CheckCircle2, AlertCircle, Calendar } from "lucide-react";

interface SyncMailModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  onSyncComplete: (newTransactions: any[]) => void;
}

export default function SyncMailModal({ isOpen, onClose, userEmail, onSyncComplete }: SyncMailModalProps) {
  const [password, setPassword] = useState("");
  const [syncMode, setSyncMode] = useState<"days" | "custom">("days");
  const [daysRange, setDaysRange] = useState(30);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSyncSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMessage("Por favor ingresa tu contraseña de aplicación.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessCount(null);

    try {
      const payload: any = {
        email: userEmail,
        password: password.trim(),
      };

      if (syncMode === "custom") {
        payload.startDate = startDate;
        payload.endDate = endDate;
      } else {
        payload.days = Number(daysRange);
      }

      const response = await fetch("https://virucheck-api.onrender.com/sync-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Error al sincronizar la bandeja de correo.");
      }

      setSuccessCount(data.count);
      onSyncComplete(data.transactions || []);
      
      setTimeout(() => {
        onClose();
        setSuccessCount(null);
        setPassword("");
      }, 2500);

    } catch (err: any) {
      console.error("Error en sincronización:", err);
      setErrorMessage(err.message || "No se pudo conectar con el servidor de correo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden p-6 space-y-5">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-400">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sincronización con Gmail</h3>
              <p className="text-[11px] text-slate-400">Extracción de facturas desde tu bandeja</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSyncSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <Label className="text-slate-300 font-bold">Correo Electrónico</Label>
            <Input type="email" disabled value={userEmail} className="h-10 rounded-xl border-slate-800 bg-slate-950 text-slate-400 cursor-not-allowed font-mono text-xs" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 font-bold flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-cyan-400" /> Contraseña de Aplicación (Gmail)
            </Label>
            <Input type="password" required placeholder="Ej. abcd efgh ijkl mnop" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl border-slate-800 bg-slate-950 text-slate-100 text-xs font-mono px-4" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 font-bold">Modo de Rango de Fecha</Label>
            <select value={syncMode} onChange={(e) => setSyncMode(e.target.value as any)} className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-200 outline-none font-medium">
              <option value="days">Últimos días (Rápido)</option>
              <option value="custom">Elegir Fechas Personalizadas</option>
            </select>
          </div>

          {syncMode === "days" ? (
            <div className="space-y-1.5">
              <Label className="text-slate-300 font-bold">Rango de Días</Label>
              <select value={daysRange} onChange={(e) => setDaysRange(Number(e.target.value))} className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-200 outline-none font-medium">
                <option value={15}>Últimos 15 días</option>
                <option value={30}>Último mes (30 días)</option>
                <option value={60}>Últimos 2 meses (60 días)</option>
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-400 font-bold">Desde</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 rounded-xl border-slate-800 bg-slate-950 text-slate-200 text-xs px-2 font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-400 font-bold">Hasta</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 rounded-xl border-slate-800 bg-slate-950 text-slate-200 text-xs px-2 font-mono" />
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-rose-400 text-[11px]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-emerald-400 text-[11px]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>¡Sincronización exitosa! Se encontraron {successCount} comprobantes desde el correo.</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 border-t border-slate-800 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="rounded-xl border-slate-700 text-xs text-slate-300 h-9 px-4">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:brightness-110 font-bold text-xs text-white h-9 px-5 gap-2">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {loading ? "Buscando en Correo..." : "Iniciar Sincronización"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}