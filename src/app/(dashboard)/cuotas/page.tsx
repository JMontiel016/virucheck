"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  getUserInstallments,
  createInstallment,
  payNextInstallment,
  deleteInstallment,
} from "@/lib/firebase/installments";
import { Installment, Currency } from "@/types";
import { formatCurrency } from "@/lib/utils/currency";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CreditCard,
  PlusCircle,
  CheckCircle2,
  Trash2,
  Calendar,
  Layers,
  ArrowRightCircle,
} from "lucide-react";

export default function CuotasPage() {
  const { user } = useAuth();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Formulario
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("PYG");
  const [totalInstallments, setTotalInstallments] = useState("12");
  const [firstDueDate, setFirstDueDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    if (!user?.uid) return;
    try {
      const data = await getUserInstallments(user.uid);
      setInstallments(data);
    } catch (err) {
      console.error("Error al cargar cuotas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !description || !totalAmount || !totalInstallments) return;

    setIsSubmitting(true);
    try {
      await createInstallment({
        userId: user.uid,
        description,
        totalAmount: parseFloat(totalAmount),
        currency,
        totalInstallments: parseInt(totalInstallments, 10),
        firstDueDate,
      });

      setDescription("");
      setTotalAmount("");
      setTotalInstallments("12");
      setShowModal(false);
      await loadData();
    } catch (err) {
      console.error("Error al registrar cuota:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayInstallment = async (item: Installment) => {
    try {
      await payNextInstallment(item);
      await loadData();
    } catch (err) {
      console.error("Error al pagar cuota:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Deseas eliminar este plan de cuotas?")) return;
    try {
      await deleteInstallment(id);
      await loadData();
    } catch (err) {
      console.error("Error al eliminar plan:", err);
    }
  };

  // Métricas
  const activeInstallments = installments.filter((i) => i.status === "active");
  const totalDeudaPendiente = activeInstallments.reduce((acc, i) => {
    const cuotasRestantes = i.totalInstallments - i.currentInstallment;
    return acc + cuotasRestantes * i.monthlyAmount;
  }, 0);

  const cuotaMensualConsolidada = activeInstallments.reduce(
    (acc, i) => acc + i.monthlyAmount,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Compras en Cuotas y Tarjetas</h1>
          <p className="text-xs text-slate-400">
            Seguimiento de compras diferidas, cuotas pendientes y compromiso mensual de pago
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2 bg-blue-600 font-medium hover:bg-blue-500">
          <PlusCircle className="h-4 w-4" />
          Registrar Compra en Cuotas
        </Button>
      </div>

      {/* Tarjetas de Resumen Financiero */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400">Total Deuda Pendiente</CardDescription>
            <CardTitle className="text-xl font-bold text-red-400">
              {formatCurrency(totalDeudaPendiente, "PYG")}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400">Impacto Mensual en Cuotas</CardDescription>
            <CardTitle className="text-xl font-bold text-amber-400">
              {formatCurrency(cuotaMensualConsolidada, "PYG")} / mes
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400">Planes Activos</CardDescription>
            <CardTitle className="text-xl font-bold text-blue-400">
              {activeInstallments.length} compras diferidas
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Modal para Registrar Nueva Compra en Cuotas */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg border-slate-800 bg-slate-900 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-lg text-slate-100">Nueva Compra en Cuotas</CardTitle>
              <CardDescription className="text-slate-400">
                Registra la adquisición para proyectar los pagos automáticos mensuales.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleCreate}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Descripción / Artículo o Servicio</Label>
                  <Input
                    placeholder="Ej: Heladera Samsung No Frost / Notebook"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    className="border-slate-800 bg-slate-950 text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Precio Total</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="Ej: 3600000"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      required
                      className="border-slate-800 bg-slate-950 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Moneda</Label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as Currency)}
                      className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    >
                      <option value="PYG">PYG (Guaraníes)</option>
                      <option value="USD">USD (Dólares)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Cantidad Total de Cuotas</Label>
                    <Input
                      type="number"
                      min="2"
                      max="120"
                      placeholder="Ej: 12"
                      value={totalInstallments}
                      onChange={(e) => setTotalInstallments(e.target.value)}
                      required
                      className="border-slate-800 bg-slate-950 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Primer Vencimiento</Label>
                    <Input
                      type="date"
                      value={firstDueDate}
                      onChange={(e) => setFirstDueDate(e.target.value)}
                      required
                      className="border-slate-800 bg-slate-950 text-slate-100"
                    />
                  </div>
                </div>
              </CardContent>
              <div className="flex justify-end gap-2 border-t border-slate-800/80 p-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white hover:bg-blue-500">
                  {isSubmitting ? "Guardando..." : "Guardar Compra"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Lista de Compras en Cuotas */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base text-slate-100">Listado de Cuotas y Amortización</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Control de cuotas saldadas vs. pendientes de pago
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Cargando compras diferidas...</div>
          ) : installments.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No tienes compras en cuotas registradas. Haz clic en <strong>Registrar Compra en Cuotas</strong>.
            </div>
          ) : (
            <div className="space-y-4">
              {installments.map((item) => {
                const isFinished = item.currentInstallment >= item.totalInstallments;
                const percent = Math.min(
                  (item.currentInstallment / item.totalInstallments) * 100,
                  100
                );
                const saldoRestante =
                  (item.totalInstallments - item.currentInstallment) * item.monthlyAmount;

                return (
                  <div
                    key={item.id}
                    className={`space-y-3 rounded-lg border p-4 transition-all ${
                      isFinished
                        ? "border-slate-800/50 bg-slate-950/20 opacity-70"
                        : "border-slate-800/80 bg-slate-950/50"
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-blue-400" />
                          <span className="font-semibold text-slate-100">{item.description}</span>
                          {isFinished && (
                            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                              FINALIZADO
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          Valor total: <span className="text-slate-300 font-semibold">{formatCurrency(item.totalAmount, item.currency)}</span>
                          {" • "}
                          Cuota mensual: <span className="text-amber-400 font-medium">{formatCurrency(item.monthlyAmount, item.currency)}</span>
                          {" • "}
                          Primer vencimiento: {item.firstDueDate}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isFinished && (
                          <Button
                            size="sm"
                            onClick={() => handlePayInstallment(item)}
                            className="gap-1.5 bg-emerald-600/20 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30 hover:bg-emerald-600/30"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Pagar Cuota ({item.currentInstallment + 1}/{item.totalInstallments})
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(item.id)}
                          className="h-8 w-8 text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Barra de progreso de cuotas */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-slate-400">
                        <span>
                          Progreso: {item.currentInstallment} de {item.totalInstallments} cuotas pagadas ({percent.toFixed(0)}%)
                        </span>
                        <span>Saldo pendiente: {formatCurrency(saldoRestante, item.currency)}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isFinished ? "bg-emerald-500" : "bg-blue-500"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}