"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/client";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
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
  AlertCircle,
  TrendingUp,
  History,
  ArrowUpDown,
  Activity,
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldAlert,
  FileText,
  Camera,
  Eye,
  RefreshCw,
  PlusCircle,
  Trash2,
  Edit3,
  AlertTriangle
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

interface ExtractedDocInfo {
  docType: "Factura" | "Nota de Crédito" | "Nota de Remisión" | "Recibo" | "Ticket" | "Documento General";
  documentNumber?: string;
  cdc?: string;
  financialType: "income" | "expense";
  amount: number;
  gravada10?: number;
  gravada5?: number;
  exenta?: number;
  businessName: string;
  productDetail: string;
  category: string;
  date: string;
  images?: string[];
}

const CATEGORIES_EXPENSE = [
  "Alimentación / Supermercado",
  "Transporte / Combustible",
  "Facturas y Servicios",
  "Tecnología y Suscripciones",
  "Vivienda / Alquiler",
  "Salud y Farmacia",
  "Ocio y Salidas",
  "Otros Gastos"
];

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

  // Filtros
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income" | "receipt" | "audit">("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Fechas
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [viewMode, setViewMode] = useState<"day" | "month" | "year">("day");
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  // Modales
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [incomeType, setIncomeType] = useState<"extra" | "advance">("extra");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formType, setFormType] = useState<"expense" | "income">("expense");
  const [formDocType, setFormDocType] = useState("Factura");
  const [formAmountInput, setFormAmountInput] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("Alimentación / Supermercado");
  const [formCounterparty, setFormCounterparty] = useState("");
  const [formPaymentMethod, setFormPaymentMethod] = useState("Transferencia");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formDocNumber, setFormDocNumber] = useState("");
  const [formCdc, setFormCdc] = useState("");
  const [formIsMyExpense, setFormIsMyExpense] = useState(true);
  const [formGravada10, setFormGravada10] = useState("");
  const [formGravada5, setFormGravada5] = useState("");
  const [formExenta, setFormExenta] = useState("");

  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusMessage, setScanStatusMessage] = useState("");
  const [scannedImages, setScannedImages] = useState<string[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [zoomImageModal, setZoomImageModal] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [salaryAmount, setSalaryAmount] = useState("");
  const [workerType, setWorkerType] = useState<"dependent" | "independent">("dependent");
  const [hasIps, setHasIps] = useState(true);
  const [appliesIva, setAppliesIva] = useState(false);
  const [employerName, setEmployerName] = useState("");
  const [paymentDay, setPaymentDay] = useState("30");
  const [salaryNotes, setSalaryNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [extraTitle, setExtraTitle] = useState("");
  const [extraAmount, setExtraAmount] = useState("");
  const [extraDate, setExtraDate] = useState(new Date().toISOString().split("T")[0]);

  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ==========================================
  // 4. CARGA DE DATOS (FIREBASE)
  // ==========================================
  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);
    getUserSalaries(user.uid).then(salData => {
      setSalaries(salData || []);
      if (salData && salData.length > 0) {
        const s = salData[0] as any;
        setSalaryAmount(String(s.amount || ""));
        setEmployerName(s.employerName || "");
        setWorkerType(s.workerType || (s.isFixed ? "dependent" : "independent"));
        setHasIps(s.hasIps ?? true);
        setAppliesIva(s.appliesIva ?? false);
        setPaymentDay(String(s.paymentDay || 30));
        setSalaryNotes(s.notes || "");
      }
    });

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

  const grossSalary = activeSalaryForMonth ? Number(activeSalaryForMonth.amount) || 0 : 0;
  const isDep = activeSalaryForMonth
    ? (activeSalaryForMonth as any).workerType === "dependent" || activeSalaryForMonth.isFixed
    : true;

  const hasIpsActive = isDep && Boolean((activeSalaryForMonth as any)?.hasIps);
  const ipsDeduction = hasIpsActive ? Math.round(grossSalary * 0.09) : 0;

  const appliesIvaActive = !isDep && Boolean((activeSalaryForMonth as any)?.appliesIva);
  const ivaDeduction = appliesIvaActive ? Math.round(grossSalary / 11) : 0;

  const netMonthlySalary = grossSalary - ipsDeduction - ivaDeduction;

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
  // 5. MANEJADORES DE ACCIÓN Y ESCÁNER OCR
  // ==========================================
  const handleOpenEdit = (item: any) => {
    if (item.kind !== "transaction") return;
    const t = item.itemRef as any;
    setEditingId(t.id);
    setScannedImages(t.receiptImages || (t.receiptImage ? [t.receiptImage] : []));
    setActivePageIndex(0);
    setFormType(t.type || "expense");
    setFormDocType(t.docType || "Factura");
    setFormAmountInput(formatPYG(t.amount));
    setFormDescription(t.description || "");
    setFormCategory(t.categoryId || "Otros Gastos");
    setFormCounterparty(t.counterpartyName || "");
    setFormPaymentMethod(t.paymentMethod || "Transferencia");
    setFormDate(t.date || new Date().toISOString().split("T")[0]);
    setFormDocNumber(t.documentNumber || "");
    setFormCdc(t.cdc || "");
    setFormIsMyExpense(t.isMyExpense !== false);
    setFormGravada10(t.gravada10 ? formatPYG(t.gravada10) : "");
    setFormGravada5(t.gravada5 ? formatPYG(t.gravada5) : "");
    setFormExenta(t.exenta ? formatPYG(t.exenta) : "");
    setShowModal(true);
  };

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanStatusMessage("Analizando con Inteligencia Artificial...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Error procesando");

      const docData: ExtractedDocInfo = await res.json();
      
      if (docData.images && docData.images.length > 0) {
        setScannedImages(docData.images);
        setActivePageIndex(0);
      }

      setEditingId(null);
      setFormType(docData.financialType || "expense");
      setFormDocType(docData.docType || "Factura");
      setFormAmountInput(formatPYG(docData.amount));
      setFormDescription(docData.productDetail || "Comprobante Escaneado");
      setFormCategory(docData.category || "Otros Gastos");
      setFormCounterparty(docData.businessName || "Comercio Emisor");
      setFormPaymentMethod("Transferencia");
      
      if (docData.date) {
        setFormDate(docData.date);
        const [y, m] = docData.date.split("-");
        setSelectedYear(parseInt(y));
        setSelectedMonth(parseInt(m) - 1);
      } else {
        setFormDate(new Date().toISOString().split("T")[0]);
      }

      setFormDocNumber(docData.documentNumber || "");
      setFormCdc(docData.cdc || "");
      setFormIsMyExpense(true);
      setFormGravada10(formatPYG(docData.gravada10 || docData.amount));
      setFormGravada5(formatPYG(docData.gravada5 || 0));
      setFormExenta(formatPYG(docData.exenta || 0));
      setShowModal(true);
    } catch (err) {
      console.error(err);
      alert("Error al procesar el archivo.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmt = parsePYG(formAmountInput);
    if (!user?.uid || cleanAmt <= 0 || !formDescription.trim()) return;

    try {
      const payload = {
        userId: user.uid,
        amount: cleanAmt,
        currency: "PYG",
        type: formType,
        docType: formDocType,
        categoryId: formCategory,
        description: formDescription.trim(),
        counterpartyName: formCounterparty.trim() || "Comercio Emisor",
        paymentMethod: formPaymentMethod,
        date: formDate,
        documentNumber: formDocNumber.trim() || "S/N",
        cdc: formCdc.trim() || "",
        isMyExpense: formIsMyExpense,
        gravada10: parsePYG(formGravada10),
        gravada5: parsePYG(formGravada5),
        exenta: parsePYG(formExenta),
        receiptImages: scannedImages,
      };

      if (editingId) {
        await updateDoc(doc(db, "transactions", editingId), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "transactions"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      setShowModal(false);
      setScannedImages([]);
    } catch (err) {
      console.error(err);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      if ((itemToDelete as any).kind === "transaction" || itemToDelete.id) {
        await deleteDoc(doc(db, "transactions", itemToDelete.id));
      }
      setItemToDelete(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !salaryAmount || !employerName.trim()) return;
    try {
      const gross = parseFloat(salaryAmount);
      const isDependent = workerType === "dependent";
      const pDay = parseInt(paymentDay) || 30;
      const existingSameMonth = salaries.find((s: any) => s.effectiveFrom === currentMonthKey);

      await saveSalaryConfig({
        id: existingSameMonth?.id,
        userId: user.uid,
        amount: gross,
        currency: "PYG",
        isFixed: isDependent,
        frequency: "MENSUAL",
        employerName: employerName.trim(),
        paymentDay: pDay,
        notes: salaryNotes.trim(),
        workerType,
        hasIps: isDependent ? hasIps : false,
        appliesIva: !isDependent ? appliesIva : false,
        ...({ effectiveFrom: currentMonthKey } as any),
      });

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
      await addDoc(collection(db, "transactions"), {
        userId: user.uid,
        amount: amountVal,
        currency: "PYG",
        type: "income",
        categoryId: "Ingreso Extra",
        description: extraTitle.trim(),
        counterpartyName: "Ingreso Extra",
        date: extraDate,
        isMyExpense: true,
        createdAt: serverTimestamp(),
      });
      setShowIncomeModal(false);
      setExtraTitle("");
      setExtraAmount("");
    } catch (err) {
      console.error("Error registrando operación:", err);
    }
  };

  // ==========================================
  // 6. GRÁFICO DINÁMICO DE TENDENCIA
  // ==========================================
  const chartData = useMemo(() => {
    if (viewMode === "day") {
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const points = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = `${currentMonthKey}-${String(day).padStart(2, "0")}`;
        const dayExpenses = myTransactions
          .filter((t) => t.type === "expense" && t.date === dayStr)
          .reduce((acc, t) => acc + Number(t.amount), 0);
        points.push({ label: `${day}`, value: dayExpenses });
      }
      return points;
    } else if (viewMode === "month") {
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
  }, [viewMode, selectedYear, selectedMonth, myTransactions, currentMonthKey]);

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
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.docx" onChange={handleFileScan} className="hidden" />

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
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
            className="flex-1 sm:flex-initial h-9 px-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs font-bold gap-1.5 transition-all shadow-lg"
          >
            {isScanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            {isScanning ? "Procesando..." : "Escanear Gasto"}
          </Button>

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

      {/* Selector de Calendario con capa aislada y sin solapamiento (z-50) */}
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

        {/* Desplegable de selección de mes y año con z-[100] absolute y fondo completamente opaco */}
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
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
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

      {/* Tarjetas Principales (Saldo y Gastos) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setShowSalaryModal(true)}
          className="group text-left relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 p-5 shadow-xl transition-all hover:border-emerald-400 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Saldo Disponible</span>
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400 group-hover:scale-110 transition-transform">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className={`mt-3 text-2xl sm:text-3xl font-black ${availableBalance >= 0 ? "text-white" : "text-rose-400"}`}>
            {formatCurrency(availableBalance, "PYG")}
          </div>
          <div className="mt-2 flex flex-col gap-1 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
            <div className="flex justify-between">
              <span>Sueldo Bruto:</span>
              <span className="text-slate-200">{formatCurrency(grossSalary, "PYG")}</span>
            </div>
            {hasIpsActive && (
              <div className="flex justify-between text-amber-400">
                <span>Deducción IPS (9% Fijo):</span>
                <span>-{formatCurrency(ipsDeduction, "PYG")}</span>
              </div>
            )}
            <div className="flex justify-between text-emerald-400 font-bold">
              <span>Sueldo Neto Inicial:</span>
              <span>{formatCurrency(netMonthlySalary, "PYG")}</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => router.push("/movimientos")}
          className="group text-left relative overflow-hidden rounded-3xl border border-rose-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/30 p-5 shadow-xl transition-all hover:border-rose-400 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Total Gastado (Propios)</span>
            <div className="rounded-xl bg-rose-500/10 p-2 text-rose-400 group-hover:scale-110 transition-transform">
              <ArrowDownRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-black text-rose-400">
            -{formatCurrency(monthExpenses, "PYG")}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{myTransactions.filter((t) => (t.date || "").startsWith(currentMonthKey) && t.type === "expense").length} gastos propios registrados</span>
            <span className="text-rose-400 font-bold group-hover:underline text-[10px]">Ir a Movimientos $\rightarrow$</span>
          </p>
        </button>
      </div>

      {/* Gráfico Dinámico */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6 backdrop-blur-xl shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400 animate-pulse" />
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider">
                Curva de Tendencia de Gastos Propios
              </h3>
              <p className="text-[10px] text-slate-400">Fluctuación de egresos en {monthNames[selectedMonth]} {selectedYear}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            <button onClick={() => setViewMode("day")} className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${viewMode === "day" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}>Por Día</button>
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
              <h3 className="text-sm sm:text-base font-bold text-slate-100">Registro de Movimientos (Gastos Propios)</h3>
              <p className="text-[11px] text-slate-400">Mostrando {paginatedList.length} de {unifiedActivityList.length} registros del mes actual</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:w-44">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-8 pl-8 text-xs rounded-xl border-slate-800 bg-slate-950 text-slate-200" />
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button onClick={() => setTypeFilter("all")} className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${typeFilter === "all" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>Todos</button>
              <button onClick={() => setTypeFilter("expense")} className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${typeFilter === "expense" ? "bg-rose-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>Gastos</button>
              <button onClick={() => setTypeFilter("income")} className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${typeFilter === "income" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>Ingresos</button>
            </div>

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
            Selecciona un mes anterior o escanea un nuevo comprobante para empezar.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {paginatedList.map((item) => {
              const isInc = item.type === "income";
              const isAudit = item.kind === "audit";
              const isReceipt = item.kind === "receipt";
              
              const txRef = item.itemRef as any;
              const imgs = txRef?.receiptImages || (txRef?.receiptImage ? [txRef.receiptImage] : []);

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

                    {!isAudit && !isReceipt && (
                      <div className="flex items-center gap-1">
                        {imgs.length > 0 && (<Button size="icon" variant="ghost" onClick={() => setZoomImageModal(imgs[0])} className="h-8 w-8 text-cyan-400 hover:bg-cyan-500/20"><Eye className="h-4 w-4" /></Button>)}
                        <Button size="icon" variant="ghost" onClick={() => handleOpenEdit(item)} className="h-8 w-8 text-blue-400 hover:bg-blue-500/20"><Edit3 className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setItemToDelete(item.itemRef)} className="h-8 w-8 text-rose-400 hover:bg-rose-500/20"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
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

      {/* MODAL CREAR / EDITAR GASTOS */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="border-b border-slate-800 bg-slate-950/80 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-white flex items-center gap-2.5"><Sparkles className="h-5 w-5 text-cyan-400" /> {editingId ? "Modificar Comprobante" : "Registrar Comprobante Escaneado"}</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 px-3 rounded-xl border-slate-700 bg-slate-950 text-[11px] text-cyan-400"><RefreshCw className="h-3 w-3 mr-1" /> Cambiar Archivo</Button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {scannedImages.length > 0 && (
                <div className="relative rounded-2xl border border-slate-800 bg-slate-950 p-3 flex flex-col items-center justify-center">
                  <div className="w-full flex items-center justify-between px-2 py-1 text-[11px] text-slate-400 border-b border-slate-800 mb-2.5">
                    <span className="flex items-center gap-1.5 text-cyan-300 font-bold"><Eye className="h-4 w-4" /> Página {activePageIndex + 1} de {scannedImages.length}</span>
                    {scannedImages.length > 1 && (
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="icon" disabled={activePageIndex === 0} onClick={() => setActivePageIndex((p) => Math.max(0, p - 1))} className="h-6 w-6 text-slate-300"><ChevronLeft className="h-3.5 w-3.5" /></Button>
                        <Button type="button" variant="ghost" size="icon" disabled={activePageIndex === scannedImages.length - 1} onClick={() => setActivePageIndex((p) => Math.min(scannedImages.length - 1, p + 1))} className="h-6 w-6 text-slate-300"><ChevronRight className="h-3.5 w-3.5" /></Button>
                      </div>
                    )}
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={scannedImages[activePageIndex]} alt={`Página`} onClick={() => setZoomImageModal(scannedImages[activePageIndex])} className="max-h-48 object-contain rounded-xl border border-slate-800 shadow-md cursor-zoom-in bg-white hover:opacity-95" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Tipo de Documento</Label>
                  <select value={formDocType} onChange={(e) => setFormDocType(e.target.value)} className="w-full h-11 rounded-2xl border border-slate-800 bg-slate-950 px-4 text-xs text-slate-100 outline-none font-medium">
                    <option value="Factura">Factura</option>
                    <option value="Nota de Crédito">Nota de Crédito</option>
                    <option value="Nota de Remisión">Nota de Remisión</option>
                    <option value="Recibo">Recibo de Dinero</option>
                    <option value="Ticket">Ticket</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">¿Es tu gasto (RUC propio)?</Label>
                  <select value={formIsMyExpense ? "true" : "false"} onChange={(e) => setFormIsMyExpense(e.target.value === "true")} className="w-full h-11 rounded-2xl border border-slate-800 bg-slate-950 px-4 text-xs text-slate-100 outline-none font-medium">
                    <option value="true">Sí (Gasto deducible / Dashboard)</option>
                    <option value="false">No (Gasto de Tercero / Solo Movimientos)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-bold">Monto Total (PYG ₲)</Label>
                <Input type="text" required value={formAmountInput} onChange={(e) => setFormAmountInput(e.target.value)} onBlur={() => { const parsed = parsePYG(formAmountInput); if (parsed > 0) setFormAmountInput(formatPYG(parsed)); }} className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 font-black text-base px-4 font-mono" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label className="text-[10px] text-slate-400 font-bold">Gravada 10%</Label><Input value={formGravada10} onChange={(e) => setFormGravada10(e.target.value)} className="h-9 rounded-xl border-slate-800 bg-slate-950 text-slate-200 text-xs px-3 font-mono" /></div>
                <div className="space-y-1"><Label className="text-[10px] text-slate-400 font-bold">Gravada 5%</Label><Input value={formGravada5} onChange={(e) => setFormGravada5(e.target.value)} className="h-9 rounded-xl border-slate-800 bg-slate-950 text-slate-200 text-xs px-3 font-mono" /></div>
                <div className="space-y-1"><Label className="text-[10px] text-slate-400 font-bold">Exenta</Label><Input value={formExenta} onChange={(e) => setFormExenta(e.target.value)} className="h-9 rounded-xl border-slate-800 bg-slate-950 text-slate-200 text-xs px-3 font-mono" /></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs text-slate-300 font-bold">Local / Emisor</Label><Input value={formCounterparty} onChange={(e) => setFormCounterparty(e.target.value)} className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs px-4" /></div>
                <div className="space-y-1.5"><Label className="text-xs text-slate-300 font-bold">N° de Documento</Label><Input placeholder="001-001-0000001" value={formDocNumber} onChange={(e) => setFormDocNumber(e.target.value)} className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs px-4 font-mono" /></div>
              </div>

              <div className="space-y-1.5"><Label className="text-xs text-slate-300 font-bold">Código CDC</Label><Input placeholder="01003798..." value={formCdc} onChange={(e) => setFormCdc(e.target.value)} className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs px-4 font-mono" /></div>

              <div className="space-y-1.5"><Label className="text-xs text-slate-300 font-bold">Detalle / Concepto</Label><Input required value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs px-4" /></div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs text-slate-300 font-bold">Fecha de Emisión</Label><Input type="date" required value={formDate} onChange={(e) => setFormDate(e.target.value)} className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs px-4 font-mono" /></div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Categoría</Label>
                  <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full h-11 rounded-2xl border border-slate-800 bg-slate-950 px-4 text-xs text-slate-100 outline-none">
                    {CATEGORIES_EXPENSE.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="rounded-xl border-slate-700 text-xs text-slate-300 h-10 px-4">Cancelar</Button>
                <Button type="submit" className="rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white h-10 px-6">Guardar</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SALARIO */}
      {showSalaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
            <div className="border-b border-slate-800 bg-slate-950/60 p-5"><h3 className="text-base font-bold text-slate-100 flex items-center gap-2"><Briefcase className="h-5 w-5 text-blue-400" /> Configurar Salario</h3></div>
            <form onSubmit={handleSaveSalary} className="p-5 space-y-4 text-xs">
              <div className="space-y-1.5"><Label className="text-xs text-slate-300">Empresa / Empleador</Label><Input value={employerName} onChange={(e) => setEmployerName(e.target.value)} required placeholder="Ej. Empresa SA" className="h-10 rounded-xl border-slate-800 bg-slate-950 text-slate-100 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs text-slate-300">Monto Bruto Acordado (PYG ₲)</Label><Input type="number" step="1000" value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} required placeholder="Ej: 3500000" className="h-11 rounded-xl border-slate-800 bg-slate-950 text-emerald-400 font-bold text-base" /></div>
              <div className="flex justify-end gap-2 border-t border-slate-800 pt-4"><Button type="button" variant="outline" onClick={() => setShowSalaryModal(false)} className="rounded-xl border-slate-700 text-xs text-slate-300">Cancelar</Button><Button type="submit" className="rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white px-5">Guardar</Button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INGRESO EXTRA */}
      {showIncomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
            <div className="border-b border-slate-800 bg-slate-950/60 p-5"><h3 className="text-base font-bold text-slate-100 flex items-center gap-2"><Sparkles className="h-5 w-5 text-emerald-400" /> Registrar Ingreso Extra</h3></div>
            <form onSubmit={handleSaveIncomeOrAdvance} className="p-5 space-y-4 text-xs">
              <div className="space-y-1.5"><Label className="text-xs text-slate-300">Concepto / Motivo</Label><Input value={extraTitle} onChange={(e) => setExtraTitle(e.target.value)} required placeholder="Ej. Bono" className="h-10 rounded-xl border-slate-800 bg-slate-950 text-slate-100 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs text-slate-300">Monto (PYG ₲)</Label><Input type="number" step="1000" value={extraAmount} onChange={(e) => setExtraAmount(e.target.value)} required placeholder="Ej: 500000" className="h-11 rounded-xl border-slate-800 bg-slate-950 text-emerald-400 font-bold text-base" /></div>
              <div className="space-y-1.5"><Label className="text-xs text-slate-300">Fecha</Label><Input type="date" value={extraDate} onChange={(e) => setExtraDate(e.target.value)} required className="h-10 rounded-xl border-slate-800 bg-slate-950 text-slate-100 text-xs" /></div>
              <div className="flex justify-end gap-2 border-t border-slate-800 pt-4"><Button type="button" variant="outline" onClick={() => setShowIncomeModal(false)} className="rounded-xl border-slate-700 text-xs text-slate-300">Cancelar</Button><Button type="submit" className="rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white px-5">Registrar</Button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ZOOM */}
      {zoomImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full h-full overflow-auto flex items-center justify-center p-4">
            <button onClick={() => setZoomImageModal(null)} className="absolute top-4 right-4 z-50 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all">Cerrar Visor ✕</button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoomImageModal} alt="Zoom factura" className="max-w-[95vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl border border-slate-700 bg-white my-auto" />
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {itemToDelete && (
        <div className="fixed render-modal fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in zoom-in-95">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0"><AlertTriangle className="h-6 w-6" /></div>
              <div className="space-y-0.5"><h3 className="text-base font-bold text-slate-100">¿Eliminar registro?</h3><p className="text-xs text-slate-400">Esta acción actualizará tu balance.</p></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setItemToDelete(null)} className="rounded-xl border-slate-700 text-xs text-slate-300">Cancelar</Button>
              <Button size="sm" disabled={isDeleting} onClick={confirmDelete} className="rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs text-white px-5">{isDeleting ? "Eliminando..." : "Sí, Eliminar"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}