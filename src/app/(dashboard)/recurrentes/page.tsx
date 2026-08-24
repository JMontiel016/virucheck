"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  getUserRecurringExpenses,
  createRecurringExpense,
  toggleRecurringStatus,
  deleteRecurringExpense,
} from "@/lib/firebase/recurring";
import { createTransaction } from "@/lib/firebase/transactions";
import { RecurringExpense, Currency } from "@/types";
import { formatCurrency } from "@/lib/utils/currency";
import { DEFAULT_CATEGORIES, getCategoryName } from "@/lib/utils/categories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Repeat,
  PlusCircle,
  Calendar,
  CheckCircle2,
  Trash2,
  Power,
  Zap,
  CreditCard,
  Building,
} from "lucide-react";

export default function RecurrentesPage() {
  const { user } = useAuth();
  const [recurringList, setRecurringList] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Formulario
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("PYG");
  const [categoryId, setCategoryId] = useState("vivienda");
  const [dueDay, setDueDay] = useState("5");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayDate = new Date();
  const currentDay = todayDate.getDate();

  const loadData = async () => {
    if (!user?.uid) return;
    try {
      const data = await getUserRecurringExpenses(user.uid);
      setRecurringList(data);
    } catch (err) {
      console.error("Error al cargar recurrentes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !description || !amount || !dueDay) return;

    setIsSubmitting(true);
    try {
      await createRecurringExpense({
        userId: user.uid,
        description,
        amount: parseFloat(amount),
        currency,
        categoryId,
        dueDay: parseInt(dueDay, 10),
      });

      setDescription("");
      setAmount("");
      setDueDay("5");
      setShowModal(false);
      await loadData();
    } catch (err) {
      console.error("Error al registrar recurrente:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (item: RecurringExpense) => {
    try {
      await toggleRecurringStatus(item.id, item.isActive);
      await loadData();
    } catch (err) {
      console.error("Error al cambiar estado:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Deseas eliminar este gasto recurrente?")) return;
    try {
      await deleteRecurringExpense(id);
      await loadData();
    } catch (err) {
      console.error("Error al eliminar recurrente:", err);
    }
  };

  // Acción rápida: Registrar este pago recurrente como movimiento del mes
  const handleRegisterAsTransaction = async (item: RecurringExpense) => {
    if (!user?.uid) return;
    const confirmRegister = confirm(
      `¿Deseas registrar un egreso de ${formatCurrency(
        item.amount,
        item.currency
      )} para "${item.description}" hoy?`
    );
    if (!confirmRegister) return;

    try {
      const todayString = new Date().toISOString().split("T")[0];
      await createTransaction({
        userId: user.uid,
        type: "expense",
        amount: item.amount,
        currency: item.currency,
        date: todayString,
        categoryId: item.categoryId,
        description: `Pago Recurrente: ${item.description}`,
        counterpartyName: item.description,
        paymentMethod: "transfer",
        isRecurring: true,
      });

      alert("¡Movimiento registrado con éxito en tu libro contable!");
    } catch (err) {
      console.error("Error al registrar transacción:", err);
      alert("Error al registrar el movimiento.");
    }
  };

  // Cálculos consolidados
  const activeItems = recurringList.filter((r) => r.isActive);
  const totalCompromisoMensual = activeItems.reduce((acc, r) => acc + r.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Gastos Recurrentes y Suscripciones</h1>
          <p className="text-xs text-slate-400">
            Control de compromisos periódicos, contratos y fechas de vencimiento mensual
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2 bg-blue-600 font-medium hover:bg-blue-500">
          <PlusCircle className="h-4 w-4" />
          Nueva Suscripción / Gasto Fijo
        </Button>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400">Compromiso Fijo Mensual</CardDescription>
            <CardTitle className="text-xl font-bold text-amber-400">
              {formatCurrency(totalCompromisoMensual, "PYG")}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400">Suscripciones Activas</CardDescription>
            <CardTitle className="text-xl font-bold text-slate-100">
              {activeItems.length} de {recurringList.length} servicios
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400">Día Actual del Mes</CardDescription>
            <CardTitle className="text-xl font-bold text-blue-400">
              Día {currentDay}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Modal para Crear Nuevo Recurrente */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md border-slate-800 bg-slate-900 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-lg text-slate-100">Nuevo Gasto Recurrente</CardTitle>
              <CardDescription className="text-slate-400">
                Registra un servicio o pago mensual fijo para prever su impacto en tu presupuesto.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleCreate}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Servicio o Concepto</Label>
                  <Input
                    placeholder="Ej: Alquiler Departamento / Internet Fibra / Spotify"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    className="border-slate-800 bg-slate-950 text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Importe Mensual</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="Ej: 250000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
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
                    <Label className="text-xs text-slate-300">Categoría</Label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    >
                      {DEFAULT_CATEGORIES.filter((c) => c.type === "expense").map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Día de Vencimiento (1 al 31)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={dueDay}
                      onChange={(e) => setDueDay(e.target.value)}
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
                  {isSubmitting ? "Guardando..." : "Guardar Recurrente"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Lista de Gastos Recurrentes */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base text-slate-100">Calendario de Pagos Periódicos</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Ordenados por día de vencimiento en el mes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Cargando compromisos...</div>
          ) : recurringList.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No tienes gastos recurrentes registrados. Haz clic en <strong>Nueva Suscripción / Gasto Fijo</strong>.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {recurringList.map((item) => {
                const daysUntilDue = item.dueDay - currentDay;
                const isPast = daysUntilDue < 0;
                const isToday = daysUntilDue === 0;
                const isUpcoming = daysUntilDue > 0 && daysUntilDue <= 5;

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center ${
                      !item.isActive ? "opacity-40" : ""
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Repeat className="h-4 w-4 text-blue-400" />
                        <span className="font-semibold text-slate-100">{item.description}</span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                          {getCategoryName(item.categoryId)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1 font-mono text-slate-300">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" />
                          Vence cada día {item.dueDay}
                        </span>
                        {item.isActive && (
                          <span>
                            {isToday ? (
                              <span className="font-bold text-amber-400">¡Vence hoy!</span>
                            ) : isUpcoming ? (
                              <span className="text-amber-300">Vence en {daysUntilDue} días</span>
                            ) : isPast ? (
                              <span className="text-slate-500">Vencimiento del ciclo anterior</span>
                            ) : (
                              <span className="text-slate-500">En {daysUntilDue} días</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-base font-bold text-slate-100">
                          {formatCurrency(item.amount, item.currency)}
                        </span>
                        <span className="block text-[11px] text-slate-500">/ mes</span>
                      </div>

                      {item.isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRegisterAsTransaction(item)}
                          className="gap-1.5 border-blue-500/30 bg-blue-500/10 text-xs font-semibold text-blue-400 hover:bg-blue-500/20"
                          title="Registrar como egreso pagado en tus movimientos de hoy"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Registrar Pago
                        </Button>
                      )}

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleToggle(item)}
                        className={`h-8 w-8 ${
                          item.isActive ? "text-emerald-400 hover:text-amber-400" : "text-slate-500 hover:text-emerald-400"
                        }`}
                        title={item.isActive ? "Pausar suscripción" : "Reactivar suscripción"}
                      >
                        <Power className="h-4 w-4" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(item.id)}
                        className="h-8 w-8 text-slate-500 hover:text-red-400"
                        title="Eliminar registro"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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