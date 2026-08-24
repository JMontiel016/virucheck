"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserBudgets, createOrUpdateBudget, deleteBudget } from "@/lib/firebase/budgets";
import { getUserTransactions } from "@/lib/firebase/transactions";
import { Budget, Transaction, Currency } from "@/types";
import { formatCurrency } from "@/lib/utils/currency";
import { DEFAULT_CATEGORIES } from "@/lib/utils/categories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function PresupuestosPage() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Formulario
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORIES[0].id);
  const [limitAmount, setLimitAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentMonthYear = new Date().toISOString().slice(0, 7);

  const loadData = async () => {
    if (!user?.uid) return;
    try {
      const [budgetsData, txsData] = await Promise.all([
        getUserBudgets(user.uid, currentMonthYear),
        getUserTransactions(user.uid),
      ]);
      setBudgets(budgetsData);
      setTransactions(txsData);
    } catch (err) {
      console.error("Error al cargar presupuestos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !limitAmount) return;

    setIsSubmitting(true);
    try {
      await createOrUpdateBudget(user.uid, selectedCategory, parseFloat(limitAmount), "PYG", currentMonthYear);
      setLimitAmount("");
      setShowModal(false);
      await loadData();
    } catch (err) {
      console.error("Error al guardar presupuesto:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Deseas eliminar este presupuesto?")) return;
    try {
      await deleteBudget(id);
      await loadData();
    } catch (err) {
      console.error("Error al eliminar presupuesto:", err);
    }
  };

  const getSpentForCategory = (catId: string) => {
    return transactions
      .filter(
        (t) =>
          t.type === "expense" &&
          t.date.startsWith(currentMonthYear) &&
          (t.categoryId === catId || (catId === "general" && !t.categoryId))
      )
      .reduce((acc, curr) => acc + curr.amount, 0);
  };

  const totalPresupuestado = budgets.reduce((acc, b) => acc + b.limit, 0);
  const totalGastadoEnPresupuestos = budgets.reduce((acc, b) => acc + getSpentForCategory(b.categoryId), 0);
  const porcentajeGlobal = totalPresupuestado > 0 ? (totalGastadoEnPresupuestos / totalPresupuestado) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Presupuestos Mensuales</h1>
          <p className="text-xs text-slate-400">
            Control de límites de gasto por categoría para el mes actual ({currentMonthYear})
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2 bg-blue-600 font-medium hover:bg-blue-500">
          <PlusCircle className="h-4 w-4" />
          Fijar Presupuesto
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400">Límite Total Presupuestado</CardDescription>
            <CardTitle className="text-xl font-bold text-slate-100">
              {formatCurrency(totalPresupuestado, "PYG")}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400">Gasto Ejecutado</CardDescription>
            <CardTitle
              className={`text-xl font-bold ${
                porcentajeGlobal >= 100
                  ? "text-red-400"
                  : porcentajeGlobal >= 75
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              {formatCurrency(totalGastadoEnPresupuestos, "PYG")}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400">Ejecución del Presupuesto</CardDescription>
            <CardTitle className="text-xl font-bold text-blue-400">
              {porcentajeGlobal.toFixed(1)}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md border-slate-800 bg-slate-900 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-lg text-slate-100">Establecer Presupuesto Mensual</CardTitle>
              <CardDescription className="text-slate-400">
                Define el importe máximo que planeas gastar en esta categoría.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveBudget}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Categoría</Label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  >
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Límite Mensual (en Guaraníes - PYG)</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Ej: 1500000"
                    value={limitAmount}
                    onChange={(e) => setLimitAmount(e.target.value)}
                    required
                    className="border-slate-800 bg-slate-950 text-slate-100"
                  />
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
                  {isSubmitting ? "Guardando..." : "Guardar Límite"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base text-slate-100">Presupuestos por Categoría</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Seguimiento de consumo con alertas automáticas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Cargando presupuestos...</div>
          ) : budgets.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              Aún no has fijado presupuestos para este mes. Haz clic en <strong>Fijar Presupuesto</strong> para empezar.
            </div>
          ) : (
            <div className="space-y-6">
              {budgets.map((b) => {
                const currencyType: Currency = (b.currency as Currency) || "PYG";
                const spent = getSpentForCategory(b.categoryId);
                const percent = b.limit > 0 ? (spent / b.limit) * 100 : 0;
                const catObj = DEFAULT_CATEGORIES.find((c) => c.id === b.categoryId);
                const catName = catObj?.name || b.categoryId;

                const isExceeded = percent >= 100;
                const isWarning = percent >= 75 && !isExceeded;

                return (
                  <div key={b.id} className="space-y-2 rounded-lg border border-slate-800/70 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isExceeded ? (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        ) : isWarning ? (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        )}
                        <span className="font-semibold text-slate-100">{catName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-400">
                          {formatCurrency(spent, currencyType)} / {formatCurrency(b.limit, currencyType)} ({percent.toFixed(1)}%)
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(b.id)}
                          className="h-7 w-7 text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isExceeded ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>

                    {isExceeded && (
                      <p className="text-[11px] font-medium text-red-400">
                        ¡Alerta! Has sobrepasado el límite fijado por {formatCurrency(spent - b.limit, currencyType)}.
                      </p>
                    )}
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