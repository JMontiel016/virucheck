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
  FileSpreadsheet
} from "lucide-react";

// ==========================================
// 1. INTERFACES Y TIPADOS DE DATOS
// ==========================================
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

// ==========================================
// 2. UTILIDADES DE MONEDA (Guaraníes)
// ==========================================
const formatPYG = (value: number | string) => {
  if (value === "" || value === null || value === undefined) return "";
  const num = typeof value === "string" ? parseFloat(value.replace(/\./g, "").replace(",", ".")) : value;
  if (isNaN(num)) return "";
  const parts = num.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${parts[0]},${parts[1]}`;
};

const parsePYG = (str: string) => {
  if (!str) return 0;
  const clean = str.toString().replace(/\./g, "").replace(",", ".");
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : val;
};

// ==========================================
// 3. COMPONENTE PRINCIPAL
// ==========================================
export default function DashboardPage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [salaries, setSalaries] = useState<SalaryConfig[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Salario Form States (Controlados en tiempo real)
  const [salaryAmount, setSalaryAmount] = useState("");
  const [hasIps, setHasIps] = useState<boolean>(true);
  const [employerName, setEmployerName] = useState("");

  // Ingreso Extra / Adelanto Form States
  const [extraTitle, setExtraTitle] = useState("");
  const [extraAmount, setExtraAmount] = useState("");
  const [extraDate, setExtraDate] = useState(new Date().toISOString().split("T")[0]);

  // ==========================================
  // 4. CARGA DE DATOS Y LIMPIEZA DE CACHÉ CADA 1s
  // ==========================================
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
          names.forEach((name) => {
            caches.delete(name);
          });
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

  // Sincronizar estado local de hasIps con el salario activo si el usuario no ha abierto el modal recientemente
  useEffect(() => {
    if (activeSalaryForMonth && (activeSalaryForMonth as any).hasIps !== undefined) {
      setHasIps(Boolean((activeSalaryForMonth as any).hasIps));
    }
  }, [activeSalaryForMonth]);

  const grossSalary = activeSalaryForMonth ? Number(activeSalaryForMonth.amount) || parsePYG(salaryAmount) || 0 : parsePYG(salaryAmount) || 0;
  
  // Cálculo instantáneo en base al estado `hasIps`
  const ipsDeduction = hasIps ? Math.round(grossSalary * 0.09) : 0;
  const netMonthlySalary = grossSalary - ipsDeduction;

  const myTransactions = useMemo(() => {
    return transactions.filter((t: any) => t.isMyExpense !== false);
  }, [transactions]);

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
        category: "Auditoría",
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

  // ==========================================
  // 5. MANEJADORES DE ACCIÓN Y CONFIGURACIONES
  // ==========================================
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
      const amountVal = parsePYG(extraAmount);
      
      if (incomeType === "advance") {
        const [y, m, d] = extraDate.split("-").map(Number);
        const nextMonthDateObj = new Date(y, m, 1);
        const nextMonthStr = nextMonthDateObj.toISOString().split("T")[0];

        // 1. Ingreso por adelanto hoy
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

        // 2. Gasto programado para el mes siguiente
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

        alert("⚠️ Adelanto salarial registrado con éxito. Se reflejará en tus movimientos de hoy y se ha programado el descuento automático como gasto para el siguiente mes.");
      } else {
        // Bono / Ingreso extra normal
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

        alert("✨ Ingreso extra / bono registrado con éxito en tus movimientos.");
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

  // ==========================================
  // 6. GRÁFICO DINÁMICO (MES / AÑO)
  // ==========================================
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

  // ==========================================
  // 7. RENDERIZADO VISUAL
  // ==========================================
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-24 md:pb-12 animate-in fade-in duration-300">
      
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Wallet className="h-6 w-6 text-blue-500 shrink-0" />
            Panel Financiero
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Hola, <span className="text-slate-200 font-semibold">{profile?.displayName || "Usuario"}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowSalaryModal(true)}
            className="flex-1 sm:flex-initial h-9 px-3.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white text-xs font-bold gap-1.5 transition-all"
          >
            <Building className="h-3.5 w-3.5" />
            {isNewUser ? "Definir Salario" : "Configurar Salario"}
          </Button>

          <Button
            size="sm"
            onClick={() => setShowIncomeModal(true)}
            className="flex-1 sm:flex-initial h-9 px-3.5 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white text-xs font-bold gap-1.5 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Ingreso Extra
          </Button>
        </div>
      </div>

      {/* Selector de Calendario */}
      <div className="relative z-50 bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="h-9 px-3 rounded-xl border-slate-800 bg-slate-950 text-xs font-bold text-slate-200 hover:text-cyan-400 hover:border-cyan-500/40 gap-2 transition-all"
          >
            <CalendarIcon className="h-4 w-4 text-cyan-400" />
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
              className="h-8 w-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-mono font-bold text-slate-300 px-2 min-w-[90px] text-center">
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
              className="h-8 w-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showDatePicker && (
          <div className="mt-3 p-4 rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 z-[100] absolute top-full left-0 w-full sm:w-80">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Seleccionar Periodo</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="h-7 rounded-lg border border-slate-800 bg-slate-900 px-2 text-xs text-cyan-400 font-bold font-mono outline-none"
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
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      isCurrent
                        ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/20"
                        : "bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800"
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

      {/* Tarjetas Principales como Botones Limpios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        {/* Tarjeta de Saldo Disponible */}
        <button
          type="button"
          onClick={() => setShowSalaryModal(true)}
          className="group text-left relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 p-5 shadow-xl transition-all hover:border-emerald-400 active:scale-[0.99] cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Saldo Disponible (Real)</span>
              <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400 group-hover:scale-110 transition-transform">
                <Wallet className="h-4 w-4" />
              </div>
            </div>

            <div className={`mt-3 text-2xl sm:text-3xl font-black ${availableBalance >= 0 ? "text-white" : "text-rose-400"}`}>
              {formatCurrency(availableBalance, "PYG")}
            </div>

            <div className="mt-3 flex flex-col gap-1.5 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5 font-mono">
              <div className="flex justify-between">
                <span>Sueldo Bruto:</span>
                <span className="text-slate-200">{formatCurrency(grossSalary, "PYG")}</span>
              </div>
              
              {hasIps ? (
                <div className="flex justify-between text-amber-400 font-bold">
                  <span>Deducción IPS (9%):</span>
                  <span>-{formatCurrency(ipsDeduction, "PYG")}</span>
                </div>
              ) : null}

              <div className="flex justify-between text-emerald-400 font-bold">
                <span>Sueldo Neto (Peso Neto):</span>
                <span>{formatCurrency(netMonthlySalary, "PYG")}</span>
              </div>

              <div className="flex justify-between text-cyan-400 pt-1 border-t border-slate-800/50">
                <span>Ingresos Extras del Mes:</span>
                <span>+{formatCurrency(monthExtraIncomes, "PYG")}</span>
              </div>
            </div>
          </div>
        </button>

        {/* Tarjeta de Total Gastado */}
        <button
          type="button"
          onClick={() => router.push("/movimientos")}
          className="group text-left relative overflow-hidden rounded-3xl border border-rose-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/30 p-5 shadow-xl transition-all hover:border-rose-400 active:scale-[0.99] cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Total Gastado (Propios)</span>
              <div className="rounded-xl bg-rose-500/10 p-2 text-rose-400 group-hover:scale-110 transition-transform">
                <ArrowDownRight className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-black text-rose-400">
              -{formatCurrency(monthExpenses, "PYG")}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              {myTransactions.filter((t) => (t.date || "").startsWith(currentMonthKey) && t.type === "expense").length} gastos registrados en el periodo.
            </p>
          </div>
        </button>

      </div>

      {/* Gráfico Dinámico (Mes / Año) */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6 backdrop-blur-xl shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400 animate-pulse" />
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider">
                Curva de Tendencia Financiera
              </h3>
              <p className="text-[10px] text-slate-400">Gasto total, saldo y sobrante en {selectedYear}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            <button onClick={() => setViewMode("month")} className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${viewMode === "month" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}>Por Mes</button>
            <button onClick={() => setViewMode("year")} className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${viewMode === "year" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}>Por Año</button>
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
                    <circle cx={pt.x} cy={pt.y} r={hasValue ? "4.5" : "2.5"} className={`transition-all duration-200 ${hasValue ? "fill-cyan-400 stroke-slate-950 stroke-2 group-hover:r-6 group-hover:fill-white" : "fill-slate-700"}`} />
                    {hasValue && (
                      <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <rect x={pt.x - 45} y={pt.y - 32} width="90" height="22" rx="6" className="fill-slate-950 stroke-slate-700" />
                        <text x={pt.x} y={pt.y - 17} textAnchor="middle" className="fill-cyan-300 text-[10px] font-mono font-bold">{formatCurrency(pt.value, "PYG")}</text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            <div className="flex justify-between px-4 pt-2 border-t border-slate-800/80">
              {chartData.map((d, i) => (<span key={i} className="text-[10px] text-slate-500 font-mono text-center flex-1">{d.label}</span>))}
            </div>
          </div>
        </div>
      </div>

      {/* Registro de Movimientos */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6 backdrop-blur-xl shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-blue-400" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100">Registro de Movimientos (Gastos e Ingresos)</h3>
              <p className="text-[11px] text-slate-400">Mostrando {paginatedList.length} de {unifiedActivityList.length} registros del periodo</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:w-44">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-8 pl-8 text-xs rounded-xl border-slate-800 bg-slate-950 text-slate-200" />
            </div>

            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="h-8 rounded-xl border border-slate-800 bg-slate-950 px-2 text-xs text-slate-200 outline-none font-bold"
            >
              <option value={10}>10 por pág</option>
              <option value={20}>20 por pág</option>
              <option value={50}>50 por pág</option>
            </select>

            <Button
              size="sm"
              onClick={exportToExcel}
              className="h-8 px-3 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white text-xs font-bold gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>

            <Button size="sm" variant="outline" onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))} className="h-8 px-2.5 rounded-xl border-slate-800 bg-slate-950 text-xs font-semibold text-slate-300 hover:text-white">
              <ArrowUpDown className="h-3.5 w-3.5 text-blue-400 mr-1" /> {sortOrder === "desc" ? "Nuevos" : "Antiguos"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
        ) : unifiedActivityList.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
            <p className="font-bold text-slate-300 mb-1">No hay datos en {monthNames[selectedMonth]} {selectedYear}.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {paginatedList.map((item) => {
              const isInc = item.type === "income";
              const isAudit = item.kind === "audit";
              const isReceipt = item.kind === "receipt";

              return (
                <div key={item.id} className="flex items-center justify-between py-3 text-xs transition-colors rounded-xl px-2 hover:bg-slate-950/60">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${isReceipt ? "bg-purple-500/10 text-purple-400" : isAudit ? "bg-amber-500/10 text-amber-400" : isInc ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                      {isReceipt ? <FileText className="h-4 w-4" /> : isAudit ? <ShieldAlert className="h-4 w-4" /> : isInc ? <TrendingUp className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-100">{item.title}</p>
                        {item.documentNumber && item.documentNumber !== "S/N" && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[10px]">N° {item.documentNumber}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">Categoría: <span className="text-slate-300 font-semibold">{item.category}</span> • Fecha: {item.date}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    <span className={`font-mono font-bold text-sm ${isAudit ? "text-amber-400" : isInc ? "text-emerald-400" : "text-rose-400"}`}>
                      {!isAudit && (isInc ? "+" : "-" )}{formatCurrency(item.amount, "PYG")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
            <span className="text-slate-400 font-mono">Página {currentPage} de {totalPages}</span>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="h-8 px-3 rounded-xl border-slate-800 bg-slate-950 text-xs font-semibold text-slate-300">Anterior</Button>
              <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} className="h-8 px-3 rounded-xl border-slate-800 bg-slate-950 text-xs font-semibold text-slate-300">Siguiente</Button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CONFIGURAR SALARIO */}
      {showSalaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-400" /> Configurar Salario e IPS
            </h3>
            
            <form onSubmit={handleSaveSalary} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Motivo / Empresa</Label>
                <Input value={employerName} onChange={(e) => setEmployerName(e.target.value)} required placeholder="Ej. Empresa SA o Salario Principal" className="h-10 rounded-xl border-slate-800 bg-slate-950 text-slate-100 text-xs" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Monto Bruto (PYG ₲)</Label>
                <Input type="number" step="1000" value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} required placeholder="Ej: 3500000" className="h-11 rounded-xl border-slate-800 bg-slate-950 text-emerald-400 font-bold text-base" />
              </div>

              {/* Interruptor Switch reactivo al instante */}
              <div className="flex items-center justify-between py-2 border-t border-b border-slate-800">
                <span className="text-xs font-bold text-slate-200">¿Aplica descuento de IPS (9%)?</span>
                <button
                  type="button"
                  onClick={() => setHasIps(!hasIps)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${hasIps ? "bg-emerald-500" : "bg-slate-700"}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${hasIps ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              <div className="space-y-1.5 pt-1">
                <Label className="text-xs text-slate-300 font-bold">¿Cómo deseas aplicar este cambio?</Label>
                <select
                  value={salaryEditMode}
                  onChange={(e) => setSalaryEditMode(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-200 outline-none font-medium"
                >
                  <option value="forward">Cambiar desde este mes en adelante (Fijo)</option>
                  <option value="all">Cambiar para todos los meses (Histórico)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowSalaryModal(false)} className="rounded-xl border-slate-700 text-xs text-slate-300">Cancelar</Button>
                <Button type="submit" className="rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white px-5">Guardar Salario</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INGRESO EXTRA UNIFICADO */}
      {showIncomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-400" /> Ingreso Extra
            </h3>

            <form onSubmit={handleSaveIncomeOrAdvance} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Tipo de Ingreso</Label>
                <select
                  value={incomeType}
                  onChange={(e) => setIncomeType(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-200 outline-none font-bold"
                >
                  <option value="extra">Bono / Ingreso Extra</option>
                  <option value="advance">Adelanto Salarial</option>
                </select>
              </div>

              {incomeType === "advance" && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-amber-300 text-[11px] leading-relaxed">
                  ⚠️ <b>Alerta:</b> Este adelanto salarial se sumará como ingreso actual en tus movimientos, pero se programará automáticamente como un <b>gasto/descuento para el siguiente mes</b>.
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Motivo / Concepto</Label>
                <Input value={extraTitle} onChange={(e) => setExtraTitle(e.target.value)} required placeholder={incomeType === "advance" ? "Ej. Adelanto Quincena" : "Ej. Bono por rendimiento"} className="h-10 rounded-xl border-slate-800 bg-slate-950 text-slate-100 text-xs" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Monto (PYG ₲)</Label>
                <Input type="number" step="1000" value={extraAmount} onChange={(e) => setExtraAmount(e.target.value)} required placeholder="Ej: 500000" className="h-11 rounded-xl border-slate-800 bg-slate-950 text-emerald-400 font-bold text-base" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Fecha</Label>
                <Input type="date" value={extraDate} onChange={(e) => setExtraDate(e.target.value)} required className="h-10 rounded-xl border-slate-800 bg-slate-950 text-slate-100 text-xs" />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowIncomeModal(false)} className="rounded-xl border-slate-700 text-xs text-slate-300">Cancelar</Button>
                <Button type="submit" className="rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white px-5">Registrar</Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}