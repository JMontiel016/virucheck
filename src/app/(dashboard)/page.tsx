/**
 * ============================================================================
 * PANEL FINANCIERO PRINCIPAL - VIRUCHECK (MODO CLARO/OSCURO, SALDO OCULTO Y REGISTROS)
 * ============================================================================
 */

"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/client";
import {
  collection,
  query,
  where,
  addDoc,
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";
import { getUserSalaries, saveSalaryConfig, SalaryConfig } from "@/lib/firebase/salaries";
import { Transaction } from "@/types";
import { formatCurrency } from "@/lib/utils/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wallet,
  Building,
  ArrowDownRight,
  Briefcase,
  Loader2,
  Sparkles,
  Calendar as CalendarIcon,
  TrendingUp,
  History,
  ArrowUpDown,
  Activity,
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldAlert,
  FileText,
  FileSpreadsheet,
  Eye,
  EyeOff
} from "lucide-react";

interface AuditLogItem {
  id: string;
  action: string;
  description: string;
  date: string;
  createdAt?: any;
}

interface ReceiptItem {
  id: string;
  receiptNumber?: string;
  clientName?: string;
  concept?: string;
  amount: number;
  currency?: string;
  type?: "income" | "expense" | "issued";
  date: string;
  createdAt?: any;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [salaries, setSalaries] = useState<SalaryConfig[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Estado para ocultar/mostrar exclusivamente el Saldo Disponible
  const [hideBalance, setHideBalance] = useState(false);

  // Filtros de Movimientos
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income" | "receipt" | "audit">("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Fechas y Vistas
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  // Modales
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryEditMode, setSalaryEditMode] = useState<"all" | "forward">("forward");

  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [incomeType, setIncomeType] = useState<"extra" | "advance">("extra");

  // Salario Form States
  const [salaryAmount, setSalaryAmount] = useState("");
  const [hasIps, setHasIps] = useState<boolean>(true);
  const [employerName, setEmployerName] = useState("");

  // Ingreso Extra / Adelanto Form States
  const [extraTitle, setExtraTitle] = useState("");
  const [extraAmount, setExtraAmount] = useState("");
  const [extraDate, setExtraDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    if (!user?.uid) return;

    const loadData = () => {
      getUserSalaries(user.uid).then(salData => {
        setSalaries(salData || []);
        if (salData && salData.length > 0) {
          const s = salData[0] as any;
          setSalaryAmount(String(s.amount || ""));
          setEmployerName(s.employerName || "");
          if (s.hasIps !== undefined) {
            setHasIps(Boolean(s.hasIps));
          }
        }
      });
    };

    loadData();

    const fastRefreshInterval = setInterval(() => {
      if ("caches" in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
    }, 1000);

    const unsubscribeTx = onSnapshot(query(collection(db, "transactions"), where("userId", "==", user.uid)), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)).filter(t => t.categoryId !== "Auditoría de Cuenta" && Number(t.amount) > 0));
    });

    const unsubscribeLogs = onSnapshot(query(collection(db, "audit_logs"), where("userId", "==", user.uid)), (snap) => {
      setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogItem)));
    });

    const unsubscribeRec = onSnapshot(query(collection(db, "receipts"), where("userId", "==", user.uid)), (snap) => {
      setReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() } as ReceiptItem)));
      setLoading(false);
    });

    return () => {
      clearInterval(fastRefreshInterval);
      unsubscribeTx();
      unsubscribeLogs();
      unsubscribeRec();
    };
  }, [user]);

  const currentMonthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

  const activeSalaryForMonth = useMemo(() => {
    if (!salaries.length) return null;
    const sorted = [...salaries].sort((a: any, b: any) => {
      const dateA = a.effectiveFrom || "2000-01";
      const dateB = b.effectiveFrom || "2000-01";
      return dateB.localeCompare(dateA);
    });
    return sorted.find((s: any) => (s.effectiveFrom || "2000-01") <= currentMonthKey) || sorted[sorted.length - 1];
  }, [salaries, currentMonthKey]);

  const isNewUser = salaries.length === 0;

  useEffect(() => {
    if (activeSalaryForMonth && (activeSalaryForMonth as any).hasIps !== undefined) {
      setHasIps(Boolean((activeSalaryForMonth as any).hasIps));
    }
  }, [activeSalaryForMonth]);

  const grossSalary = activeSalaryForMonth ? Number(activeSalaryForMonth.amount) || Number(salaryAmount) || 0 : Number(salaryAmount) || 0;
  const ipsDeduction = hasIps ? Math.round(grossSalary * 0.09) : 0;
  const netMonthlySalary = grossSalary - ipsDeduction;

  const myTransactions = useMemo(() => {
    return transactions.filter((t: any) => t.isMyExpense !== false);
  }, [transactions]);

  // Lista unificada que incluye Movimientos, Recibos y Auditorías
  const unifiedActivityList = useMemo(() => {
    const txPeriod = myTransactions
      .filter((t) => (t.date || "").startsWith(currentMonthKey))
      .map((t: any) => ({
        id: t.id,
        kind: "transaction",
        type: t.type,
        title: t.description,
        category: t.categoryId || t.docType || "General",
        amount: Number(t.amount) || 0,
        date: t.date || "",
        documentNumber: t.documentNumber || "S/N",
        itemRef: t,
      }));

    const receiptsPeriod = receipts
      .filter((r) => (r.date || "").startsWith(currentMonthKey))
      .map((r) => ({
        id: r.id,
        kind: "receipt",
        type: r.type || "income",
        title: `Recibo #${r.receiptNumber || "S/N"}: ${r.concept || "Cobro"} (${r.clientName || "Cliente"})`,
        category: "Recibo Emitido",
        amount: Number(r.amount) || 0,
        date: r.date || "",
        documentNumber: r.receiptNumber || "S/N",
        itemRef: r,
      }));

    const logsPeriod = auditLogs
      .filter((l) => (l.date || "").startsWith(currentMonthKey))
      .map((l) => ({
        id: l.id,
        kind: "audit",
        type: "audit" as any,
        title: l.description,
        category: "Auditoría del Sistema",
        amount: 0,
        date: l.date || "",
        documentNumber: "S/N",
        itemRef: l,
      }));

    let combined = [...txPeriod, ...receiptsPeriod, ...logsPeriod];

    if (typeFilter !== "all") {
      combined = combined.filter((item) => {
        if (typeFilter === "audit") return item.kind === "audit";
        if (typeFilter === "receipt") return item.kind === "receipt";
        return item.type === typeFilter && item.kind === "transaction";
      });
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      combined = combined.filter(
        (i) => i.title.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || i.documentNumber.toLowerCase().includes(q)
      );
    }

    return combined.sort((a, b) => {
      const dateA = a.date || "";
      const dateB = b.date || "";
      return sortOrder === "desc" ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
    });
  }, [myTransactions, receipts, auditLogs, currentMonthKey, typeFilter, searchTerm, sortOrder]);

  const totalPages = Math.ceil(unifiedActivityList.length / itemsPerPage) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return unifiedActivityList.slice(start, start + itemsPerPage);
  }, [unifiedActivityList, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [currentMonthKey, itemsPerPage, searchTerm, typeFilter]);

  const monthExpenses = useMemo(() => {
    return myTransactions
      .filter((t) => (t.date || "").startsWith(currentMonthKey) && t.type === "expense")
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  }, [myTransactions, currentMonthKey]);

  const monthExtraIncomes = useMemo(() => {
    return myTransactions
      .filter(
        (t) =>
          (t.date || "").startsWith(currentMonthKey) &&
          t.type === "income" &&
          t.categoryId !== "Auditoría de Cuenta" &&
          !t.description?.includes("[Salario Base]")
      )
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  }, [myTransactions, currentMonthKey]);

  const totalMonthlyLiquidity = (grossSalary > 0 ? netMonthlySalary : 0) + monthExtraIncomes;
  const availableBalance = totalMonthlyLiquidity - monthExpenses;

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !salaryAmount || !employerName.trim()) return;
    try {
      const gross = parseFloat(salaryAmount);
      const effectiveKey = salaryEditMode === "forward" ? currentMonthKey : "2000-01";

      await saveSalaryConfig({
        userId: user.uid,
        amount: gross,
        currency: "PYG",
        isFixed: true,
        frequency: "MENSUAL",
        employerName: employerName.trim(),
        paymentDay: 30,
        notes: "",
        workerType: "dependent",
        hasIps,
        appliesIva: false,
        effectiveFrom: effectiveKey,
      } as any);

      setShowSalaryModal(false);
    } catch (err) {
      console.error("Error al guardar salario:", err);
    }
  };

  const handleSaveIncomeOrAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !extraAmount || !extraTitle.trim()) return;
    try {
      const amountVal = parseFloat(extraAmount);
      
      if (incomeType === "advance") {
        const [y, m, d] = extraDate.split("-").map(Number);
        const nextMonthDateObj = new Date(y, m, 1);
        const nextMonthStr = nextMonthDateObj.toISOString().split("T")[0];

        await addDoc(collection(db, "transactions"), {
          userId: user.uid,
          amount: amountVal,
          currency: "PYG",
          type: "income",
          categoryId: "Adelanto Salarial",
          description: `[Adelanto] ${extraTitle.trim()}`,
          counterpartyName: "Adelanto",
          date: extraDate,
          isMyExpense: true,
          createdAt: serverTimestamp(),
        });

        await addDoc(collection(db, "transactions"), {
          userId: user.uid,
          amount: amountVal,
          currency: "PYG",
          type: "expense",
          categoryId: "Descuento Adelanto",
          description: `[Descuento Adelanto] ${extraTitle.trim()}`,
          counterpartyName: "Nómina",
          date: nextMonthStr,
          isMyExpense: true,
          createdAt: serverTimestamp(),
        });

        alert("⚠️ Adelanto registrado con éxito. Se programó el descuento automático como gasto para el siguiente mes.");
      } else {
        await addDoc(collection(db, "transactions"), {
          userId: user.uid,
          amount: amountVal,
          currency: "PYG",
          type: "income",
          categoryId: "Bono / Ingreso Extra",
          description: `[Bono] ${extraTitle.trim()}`,
          counterpartyName: "Ingreso Extra",
          date: extraDate,
          isMyExpense: true,
          createdAt: serverTimestamp(),
        });

        alert("✨ Ingreso extra registrado con éxito.");
      }

      setShowIncomeModal(false);
      setExtraTitle("");
      setExtraAmount("");
    } catch (err) {
      console.error("Error registrando operación:", err);
    }
  };

  const exportToExcel = () => {
    if (unifiedActivityList.length === 0) {
      alert("No hay registros para exportar en este periodo.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,Fecha;Tipo;Concepto;Categoria;Documento;Monto (PYG)\r\n";
    unifiedActivityList.forEach(item => {
      csvContent += `${item.date};${item.type};${item.title};${item.category};${item.documentNumber};${item.amount}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Movimientos_${selectedYear}_${selectedMonth + 1}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const chartData = useMemo(() => {
    if (viewMode === "month") {
      const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
      return months.map((m, idx) => {
        const mKey = `${selectedYear}-${String(idx + 1).padStart(2, "0")}`;
        const mExp = myTransactions
          .filter((t) => t.type === "expense" && (t.date || "").startsWith(mKey))
          .reduce((acc, t) => acc + Number(t.amount), 0);
        return { label: m, value: mExp };
      });
    } else {
      const years = [];
      for (let y = selectedYear - 4; y <= selectedYear + 1; y++) {
        const yExp = myTransactions
          .filter((t) => t.type === "expense" && (t.date || "").startsWith(`${y}`))
          .reduce((acc, t) => acc + Number(t.amount), 0);
        years.push({ label: `${y}`, value: yExp });
      }
      return years;
    }
  }, [viewMode, selectedYear, myTransactions]);

  const maxChartVal = Math.max(...chartData.map((d) => d.value), 100000);
  const svgWidth = 700;
  const svgHeight = 160;
  const paddingX = 25;
  const paddingY = 25;

  const pointsCoordinates = useMemo(() => {
    const total = chartData.length;
    if (total === 0) return [];
    return chartData.map((item, i) => {
      const x = paddingX + (i / (total - 1 || 1)) * (svgWidth - paddingX * 2);
      const ratio = item.value / maxChartVal;
      const y = svgHeight - paddingY - ratio * (svgHeight - paddingY * 2);
      return { x, y, ...item };
    });
  }, [chartData, maxChartVal, svgWidth, svgHeight]);

  const linePathD = useMemo(() => {
    if (pointsCoordinates.length < 2) return "";
    return pointsCoordinates.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x},${pt.y}`;
      const prev = arr[i - 1];
      const cx = (prev.x + pt.x) / 2;
      return `${acc} C ${cx},${prev.y} ${cx},${pt.y} ${pt.x},${pt.y}`;
    }, "");
  }, [pointsCoordinates]);

  const areaPathD = useMemo(() => {
    if (pointsCoordinates.length < 2) return "";
    const first = pointsCoordinates[0];
    const last = pointsCoordinates[pointsCoordinates.length - 1];
    return `${linePathD} L ${last.x},${svgHeight} L ${first.x},${svgHeight} Z`;
  }, [linePathD, pointsCoordinates, svgHeight]);

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const shortMonthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
  const availableYears = Array.from({ length: 16 }, (_, i) => 2020 + i);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-24 md:pb-12 animate-in fade-in duration-300">
      
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Wallet className="h-6 w-6 text-blue-600 dark:text-blue-500 shrink-0" />
            Panel Financiero
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Hola, <span className="text-slate-900 dark:text-slate-200 font-semibold">{profile?.displayName || "Usuario"}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowSalaryModal(true)}
            className="flex-1 sm:flex-initial h-9 px-3.5 rounded-xl bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white text-xs font-bold gap-1.5 transition-all cursor-pointer"
          >
            <Building className="h-3.5 w-3.5" />
            {isNewUser ? "Definir Salario" : "Configurar Salario"}
          </Button>

          <Button
            size="sm"
            onClick={() => setShowIncomeModal(true)}
            className="flex-1 sm:flex-initial h-9 px-3.5 rounded-xl bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white text-xs font-bold gap-1.5 transition-all cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Ingreso Extra
          </Button>
        </div>
      </div>

      {/* Selector de Calendario */}
      <div className="relative z-40 bg-white/90 dark:bg-slate-900/90 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="h-9 px-3 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 gap-2 transition-all cursor-pointer"
          >
            <CalendarIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <span>{monthNames[selectedMonth]} {selectedYear}</span>
          </Button>

          <div className="flex items-center gap-1.5">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (selectedMonth === 0) {
                  setSelectedMonth(11);
                  setSelectedYear((prev) => prev - 1);
                } else {
                  setSelectedMonth((prev) => prev - 1);
                }
              }}
              className="h-8 w-8 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 px-2 min-w-[90px] text-center">
              {shortMonthNames[selectedMonth]} {selectedYear}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (selectedMonth === 11) {
                  setSelectedMonth(0);
                  setSelectedYear((prev) => prev + 1);
                } else {
                  setSelectedMonth((prev) => prev + 1);
                }
              }}
              className="h-8 w-8 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showDatePicker && (
          <div className="mt-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 z-50 absolute top-full left-0 w-full sm:w-80">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Seleccionar Periodo</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="h-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-2 text-xs text-cyan-600 dark:text-cyan-400 font-bold font-mono outline-none cursor-pointer"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {shortMonthNames.map((name, idx) => {
                const isCurrent = idx === selectedMonth;
                return (
                  <button
                    key={name}
                    onClick={() => {
                      setSelectedMonth(idx);
                      setShowDatePicker(false);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/20"
                        : "bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tarjetas Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        {/* Tarjeta de Saldo Disponible con Botón de Ojo */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-white via-slate-50 to-emerald-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/40 p-5 shadow-xl transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Saldo Disponible (Real)</span>
              
              <div className="flex items-center gap-2">
                {/* Botón de Ojo para ocultar/mostrar únicamente el saldo */}
                <button
                  type="button"
                  onClick={() => setHideBalance(!hideBalance)}
                  title={hideBalance ? "Mostrar saldo" : "Ocultar saldo"}
                  className="rounded-xl bg-slate-200 dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {hideBalance ? <EyeOff className="h-4 w-4 text-amber-500" /> : <Eye className="h-4 w-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowSalaryModal(true)}
                  className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400 hover:scale-110 transition-transform cursor-pointer"
                >
                  <Wallet className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className={`mt-3 text-2xl sm:text-3xl font-black ${availableBalance >= 0 ? "text-slate-900 dark:text-white" : "text-rose-600 dark:text-rose-400"}`}>
              {hideBalance ? "••••••••••••" : formatCurrency(availableBalance, "PYG")}
            </div>

            <div className="mt-3 flex flex-col gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/80 pt-2.5 font-mono">
              <div className="flex justify-between">
                <span>Sueldo Bruto:</span>
                <span className="text-slate-800 dark:text-slate-200">{hideBalance ? "••••••" : formatCurrency(grossSalary, "PYG")}</span>
              </div>
              
              {hasIps ? (
                <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold">
                  <span>Deducción IPS (9%):</span>
                  <span>{hideBalance ? "••••••" : `-${formatCurrency(ipsDeduction, "PYG")}`}</span>
                </div>
              ) : null}

              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                <span>Sueldo Neto (Peso Neto):</span>
                <span>{hideBalance ? "••••••" : formatCurrency(netMonthlySalary, "PYG")}</span>
              </div>

              <div className="flex justify-between text-cyan-600 dark:text-cyan-400 pt-1 border-t border-slate-200 dark:border-slate-800/50">
                <span>Ingresos Extras del Mes:</span>
                <span>{hideBalance ? "••••••" : `+${formatCurrency(monthExtraIncomes, "PYG")}`}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tarjeta de Total Gastado */}
        <button
          type="button"
          onClick={() => router.push("/movimientos")}
          className="group text-left relative overflow-hidden rounded-3xl border border-rose-500/30 bg-gradient-to-br from-white via-slate-50 to-rose-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-rose-950/30 p-5 shadow-xl transition-all hover:border-rose-400 active:scale-[0.99] cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Total Gastado (Propios)</span>
              <div className="rounded-xl bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                <ArrowDownRight className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400">
              -{formatCurrency(monthExpenses, "PYG")}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400">
              {myTransactions.filter((t) => (t.date || "").startsWith(currentMonthKey) && t.type === "expense").length} gastos registrados en el periodo.
            </p>
          </div>
        </button>

      </div>

      {/* Gráfico Dinámico (Mes / Año) */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-5 sm:p-6 backdrop-blur-xl shadow-lg space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-600 dark:text-cyan-400 animate-pulse" />
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Curva de Tendencia Financiera
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Gasto total y comparativa en {selectedYear}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 self-start sm:self-auto">
            <button onClick={() => setViewMode("month")} className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${viewMode === "month" ? "bg-blue-600 text-white shadow-md" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"}`}>Por Mes</button>
            <button onClick={() => setViewMode("year")} className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${viewMode === "year" ? "bg-blue-600 text-white shadow-md" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"}`}>Por Año</button>
          </div>
        </div>

        <div className="overflow-x-auto pb-2 pt-2">
          <div className="min-w-[650px] relative">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-44 overflow-visible">
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>

              {areaPathD && <path d={areaPathD} fill="url(#areaGradient)" />}
              {linePathD && <path d={linePathD} fill="none" stroke="url(#lineGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}

              {pointsCoordinates.map((pt, idx) => {
                const hasValue = pt.value > 0;
                return (
                  <g key={idx} className="group cursor-pointer">
                    <circle cx={pt.x} cy={pt.y} r={hasValue ? "4.5" : "2.5"} className={`transition-all duration-200 ${hasValue ? "fill-cyan-500 dark:fill-cyan-400 stroke-white dark:stroke-slate-950 stroke-2 group-hover:r-6" : "fill-slate-400 dark:fill-slate-700"}`} />
                    {hasValue && (
                      <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <rect x={pt.x - 45} y={pt.y - 32} width="90" height="22" rx="6" className="fill-slate-900 stroke-slate-700 shadow-xl" />
                        <text x={pt.x} y={pt.y - 17} textAnchor="middle" className="fill-cyan-300 text-[10px] font-mono font-bold">{formatCurrency(pt.value, "PYG")}</text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            <div className="flex justify-between px-4 pt-2 border-t border-slate-200 dark:border-slate-800/80">
              {chartData.map((d, i) => (<span key={i} className="text-[10px] text-slate-500 font-mono text-center flex-1">{d.label}</span>))}
            </div>
          </div>
        </div>
      </div>

      {/* Registro de Movimientos, Recibos e Ingresos */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-5 sm:p-6 backdrop-blur-xl shadow-lg space-y-4 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Registro de Movimientos, Recibos e Ingresos</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Mostrando {paginatedList.length} de {unifiedActivityList.length} registros del periodo</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:w-44">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input placeholder="Buscar por concepto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-8 pl-8 text-xs rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200" />
            </div>

            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="h-8 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 text-xs text-slate-800 dark:text-slate-200 outline-none font-bold cursor-pointer"
            >
              <option value={10}>10 por pág</option>
              <option value={20}>20 por pág</option>
              <option value={50}>50 por pág</option>
            </select>

            <Button
              size="sm"
              onClick={exportToExcel}
              className="h-8 px-3 rounded-xl bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white text-xs font-bold gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>

            <Button size="sm" variant="outline" onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))} className="h-8 px-2.5 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer">
              <ArrowUpDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mr-1" /> {sortOrder === "desc" ? "Nuevos" : "Antiguos"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
        ) : unifiedActivityList.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-950/40">
            <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">No hay registros en {monthNames[selectedMonth]} {selectedYear}.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {paginatedList.map((item) => {
              const isInc = item.type === "income";
              const isAudit = item.kind === "audit";
              const isReceipt = item.kind === "receipt";

              return (
                <div key={item.id} className="flex items-center justify-between py-3 text-xs transition-colors rounded-xl px-2 hover:bg-slate-100 dark:hover:bg-slate-950/60">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${isReceipt ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" : isAudit ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : isInc ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
                      {isReceipt ? <FileText className="h-4 w-4" /> : isAudit ? <ShieldAlert className="h-4 w-4" /> : isInc ? <TrendingUp className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 dark:text-slate-100">{item.title}</p>
                        {item.documentNumber && item.documentNumber !== "S/N" && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 font-mono text-[10px]">N° {item.documentNumber}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">Categoría: <span className="text-slate-800 dark:text-slate-300 font-semibold">{item.category}</span> • Fecha: {item.date}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    <span className={`font-mono font-bold text-sm ${isAudit ? "text-amber-600 dark:text-amber-400" : isInc ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {!isAudit && (isInc ? "+" : "-" )}{formatCurrency(item.amount, "PYG")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-mono">Página {currentPage} de {totalPages}</span>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="h-8 px-3 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">Anterior</Button>
              <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} className="h-8 px-3 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">Siguiente</Button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CONFIGURAR SALARIO */}
      {showSalaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in zoom-in-95">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-600 dark:text-blue-400" /> Configuración de Salario y Deducciones
            </h3>
            
            <form onSubmit={handleSaveSalary} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 dark:text-slate-300 font-bold">Empresa o Empleador</Label>
                <Input value={employerName} onChange={(e) => setEmployerName(e.target.value)} required placeholder="Ej. Banco Continental S.A. o Empresa Principal" className="h-10 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs px-3" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 dark:text-slate-300 font-bold">Sueldo Bruto Mensual (₲)</Label>
                <Input type="number" step="1000" value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} required placeholder="Ej: 3500000" className="h-11 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 font-bold text-base px-3 font-mono" />
              </div>

              <div className="flex items-center justify-between py-2 border-t border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">¿Aplicar descuento obligatorio de IPS (9%)?</span>
                <button
                  type="button"
                  onClick={() => setHasIps(!hasIps)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${hasIps ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-700"}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${hasIps ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              <div className="space-y-1.5 pt-1">
                <Label className="text-xs text-slate-700 dark:text-slate-300 font-bold">Aplicar configuración en el tiempo</Label>
                <select
                  value={salaryEditMode}
                  onChange={(e) => setSalaryEditMode(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-slate-200 outline-none font-medium cursor-pointer"
                >
                  <option value="forward">Desde este mes en adelante (Fijo)</option>
                  <option value="all">Para todos los meses anteriores y futuros (Histórico)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowSalaryModal(false)} className="rounded-xl border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">Cancelar</Button>
                <Button type="submit" className="rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white px-5 cursor-pointer">Guardar Salario</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INGRESO EXTRA / ADELANTO */}
      {showIncomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in zoom-in-95">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Registrar Ingreso Extra o Adelanto
            </h3>

            <form onSubmit={handleSaveIncomeOrAdvance} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 dark:text-slate-300 font-bold">Categoría del Ingreso</Label>
                <select
                  value={incomeType}
                  onChange={(e) => setIncomeType(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-slate-200 outline-none font-bold cursor-pointer"
                >
                  <option value="extra">Bono, Comisión u Horas Extras</option>
                  <option value="advance">Adelanto Salarial (Descuento automático próximo mes)</option>
                </select>
              </div>

              {incomeType === "advance" && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-amber-700 dark:text-amber-300 text-[11px] leading-relaxed">
                  ⚠️ <b>Aviso:</b> El adelanto se sumará a tus ingresos del mes actual, pero se programará automáticamente un descuento como gasto para el mes siguiente.
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 dark:text-slate-300 font-bold">Concepto / Descripción</Label>
                <Input value={extraTitle} onChange={(e) => setExtraTitle(e.target.value)} required placeholder={incomeType === "advance" ? "Ej. Adelanto Quincena de Septiembre" : "Ej. Bono por cumplimiento de metas"} className="h-10 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs px-3" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 dark:text-slate-300 font-bold">Monto (₲)</Label>
                <Input type="number" step="1000" value={extraAmount} onChange={(e) => setExtraAmount(e.target.value)} required placeholder="Ej: 500000" className="h-11 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 font-bold text-base px-3 font-mono" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 dark:text-slate-300 font-bold">Fecha de Recepción</Label>
                <Input type="date" value={extraDate} onChange={(e) => setExtraDate(e.target.value)} required className="h-10 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs px-3" />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowIncomeModal(false)} className="rounded-xl border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">Cancelar</Button>
                <Button type="submit" className="rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white px-5 cursor-pointer">Registrar Operación</Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}