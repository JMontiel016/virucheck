"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserTransactions } from "@/lib/firebase/transactions";
import { getUserBudgets } from "@/lib/firebase/budgets";
import { Transaction, Budget } from "@/types";
import { formatCurrency } from "@/lib/utils/currency";
import { getCategoryName } from "@/lib/utils/categories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, Award, ArrowUpRight, BarChart2 } from "lucide-react";

export default function AnaliticaPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    Promise.all([getUserTransactions(user.uid), getUserBudgets(user.uid)])
      .then(([txs, bgts]) => {
        setTransactions(txs);
        setBudgets(bgts);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [user]);

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + t.amount, 0);

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  // Agrupación de gastos por categoría
  const expenseByCategory: Record<string, number> = {};
  transactions
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      const cat = t.categoryId || "general";
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + t.amount;
    });

  const sortedCategories = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <BarChart2 className="h-6 w-6 text-blue-400" />
          Analítica Financiera & Metas de Ahorro
        </h1>
        <p className="text-xs text-slate-400">
          Evaluación de salud patrimonial, distribución de costos e indicadores de rentabilidad personal
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400">Tasa de Ahorro / Superávit</CardDescription>
            <CardTitle className={`text-2xl font-bold ${savingsRate >= 20 ? "text-emerald-400" : "text-amber-400"}`}>
              {savingsRate.toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-slate-400">
              {savingsRate >= 20
                ? "¡Excelente! Estás por encima del 20% de ahorro recomendado."
                : "Se recomienda reducir costos fijos para alcanzar al menos el 20%."}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400">Ahorro Neto Acumulado</CardDescription>
            <CardTitle className={`text-2xl font-bold ${netSavings >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrency(netSavings, "PYG")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-slate-400">Diferencia neta entre todos los ingresos y egresos</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-slate-400">Presupuestos Mensuales</CardDescription>
            <CardTitle className="text-2xl font-bold text-blue-400">
              {budgets.length} activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-slate-400">Límites fijados para contención de egresos</p>
          </CardContent>
        </Card>
      </div>

      {/* Desglose de Gastos */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base text-slate-100">Distribución de Gastos por Categoría</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Principales rubros de destino de tus recursos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-xs text-slate-500">Cargando métricas...</p>
          ) : sortedCategories.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">Aún no hay transacciones suficientes registradas.</p>
          ) : (
            <div className="space-y-4">
              {sortedCategories.map(([catId, amount]) => {
                const percent = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
                return (
                  <div key={catId} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-200">{getCategoryName(catId)}</span>
                      <span className="font-mono text-slate-400">
                        {formatCurrency(amount, "PYG")} ({percent.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percent}%` }} />
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