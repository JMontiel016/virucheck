/**
 * ============================================================================
 * MÓDULO PROFESIONAL DE MOVIMIENTOS, CUOTAS Y PRÉSTAMOS - VIRUCHECK
 * ============================================================================
 * Incluye gestión de cuotas mes a mes con interés por mora, préstamos simultáneos,
 * escáner IA, diseño moderno y campos fiscales completos opcionales.
 */

"use client";

import SyncMailModal from "@/components/SyncMailModal";
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/client";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ReceiptText,
  PlusCircle,
  Search,
  ArrowUpDown,
  Trash2,
  Edit3,
  Loader2,
  Tag,
  ShoppingBag,
  Car,
  Home,
  Coffee,
  HeartPulse,
  Zap,
  AlertTriangle,
  Camera,
  Sparkles,
  RefreshCw,
  Eye,
  Laptop,
  ChevronLeft,
  ChevronRight,
  Mail,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  FileText,
  CalendarIcon,
  CreditCard,
  Percent
} from "lucide-react";

// ==========================================
// 1. INTERFACES Y TIPADOS DE DATOS
// ==========================================
interface TransactionItem {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  type: "income" | "expense";
  categoryId: string;
  description: string;
  counterpartyName?: string;
  paymentMethod?: string;
  date: string;
  documentNumber?: string;
  cdc?: string;
  docType?: string;
  isMyExpense?: boolean;
  isFiscalInvoice?: boolean;
  
  // Control de Cuotas y Préstamos
  isInstallment?: boolean;
  installmentCurrent?: number;
  installmentTotal?: number;
  isPaid?: boolean;
  interestRate?: number;

  isLoan?: boolean;
  loanRemainingBalance?: number;

  gravada10?: number;
  gravada5?: number;
  exenta?: number;
  receiptImages?: string[];
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
  { id: "Alimentación / Supermercado", icon: ShoppingBag },
  { id: "Transporte / Combustible", icon: Car },
  { id: "Facturas y Servicios", icon: Zap },
  { id: "Tecnología y Suscripciones", icon: Laptop },
  { id: "Vivienda / Alquiler", icon: Home },
  { id: "Salud y Farmacia", icon: HeartPulse },
  { id: "Ocio y Salidas", icon: Coffee },
  { id: "Cuotas y Créditos", icon: CreditCard },
  { id: "Préstamos Bancarios", icon: Percent },
  { id: "Otros Gastos", icon: Tag },
];

const CATEGORIES_INCOME = [
  "Salario Principal",
  "Bono / Ingreso Extra",
  "Adelanto Salarial",
  "Ventas / Servicios",
  "Otros Ingresos"
];

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
// 2. COMPONENTE PRINCIPAL
// ==========================================
export default function MovimientosPage() {
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Pestañas principales
  const [activeTab, setActiveTab] = useState<"propias" | "terceros" | "recibos">("propias");

  // Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Paginación
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Fechas y Periodo
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  // Modal Crear / Editar detallado
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formType, setFormType] = useState<"expense" | "income">("expense");
  const [isFiscalInvoice, setIsFiscalInvoice] = useState<boolean>(true); // [CORREGIDO AQUÍ]
  const [formDocType, setFormDocType] = useState("Factura");
  const [formAmountInput, setFormAmountInput] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("Alimentación / Supermercado");
  const [formCounterparty, setFormCounterparty] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formDocNumber, setFormDocNumber] = useState("");
  const [formCdc, setFormCdc] = useState("");
  const [formIsMyExpense, setFormIsMyExpense] = useState(true);
  
  // Campos tributarios opcionales
  const [formGravada10, setFormGravada10] = useState("");
  const [formGravada5, setFormGravada5] = useState("");
  const [formExenta, setFormExenta] = useState("");

  // Cuotas y Préstamos
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentTotal, setInstallmentTotal] = useState("12");
  const [installmentInterest, setInstallmentInterest] = useState("0");
  const [isLoan, setIsLoan] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Escáner OCR y Visor PNG
  const [isScanning, setIsScanning] = useState(false);
  const [scannedImages, setScannedImages] = useState<string[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [zoomImageModal, setZoomImageModal] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showSyncMailModal, setShowSyncMailModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<TransactionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ==========================================
  // 3. CARGA DE DATOS EN TIEMPO REAL (FIREBASE)
  // ==========================================
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(collection(db, "transactions"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as TransactionItem))
          .filter((t) => t.categoryId !== "Auditoría de Cuenta" && Number(t.amount) > 0);

        setTransactions(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error en snapshot:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const currentMonthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

  // ==========================================
  // 4. FILTRADO POR PESTAÑAS Y BÚSQUEDA
  // ==========================================
  const filteredList = useMemo(() => {
    let result = transactions.filter((t) => {
      const isRecibo = (t.docType || "").toLowerCase().includes("recibo");
      const isMyExp = t.isMyExpense !== false;
      const belongsToCurrentMonth = (t.date || "").startsWith(currentMonthKey);

      if (activeTab === "recibos") return isRecibo && belongsToCurrentMonth;
      if (activeTab === "terceros") return !isRecibo && !isMyExp && belongsToCurrentMonth;
      return !isRecibo && isMyExp && belongsToCurrentMonth;
    });

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          t.description?.toLowerCase().includes(q) ||
          t.counterpartyName?.toLowerCase().includes(q) ||
          t.documentNumber?.toLowerCase().includes(q) ||
          t.cdc?.toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      const dateA = a.date || "";
      const dateB = b.date || "";
      return sortOrder === "desc" ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
    });
  }, [transactions, activeTab, currentMonthKey, searchTerm, sortOrder]);

  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredList.slice(start, start + itemsPerPage);
  }, [filteredList, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [currentMonthKey, itemsPerPage, searchTerm, activeTab]);

  const myTransactions = useMemo(
    () => transactions.filter((t) => t.isMyExpense !== false && (t.date || "").startsWith(currentMonthKey)),
    [transactions, currentMonthKey]
  );

  const totalIncomes = useMemo(
    () => myTransactions.filter((t) => t.type === "income").reduce((acc, t) => acc + (Number(t.amount) || 0), 0),
    [myTransactions]
  );
  const totalExpenses = useMemo(
    () => myTransactions.filter((t) => t.type === "expense").reduce((acc, t) => acc + (Number(t.amount) || 0), 0),
    [myTransactions]
  );

  // ==========================================
  // 5. CAMBIAR ESTADO DE PAGO DE CUOTAS
  // ==========================================
  const toggleInstallmentPaid = async (item: TransactionItem) => {
    try {
      const newPaidState = !item.isPaid;
      let finalAmount = item.amount;

      if (newPaidState && item.interestRate && item.interestRate > 0) {
        const interestExtra = (item.amount * item.interestRate) / 100;
        finalAmount += interestExtra;
      }

      await updateDoc(doc(db, "transactions", item.id), {
        isPaid: newPaidState,
        amount: finalAmount,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error al actualizar cuota:", err);
    }
  };

  // ==========================================
  // 6. GRÁFICO DE EVOLUCIÓN EXTENDIDO
  // ==========================================
  const chartData = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const points = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${currentMonthKey}-${String(day).padStart(2, "0")}`;
      
      const income = transactions.filter((t) => t.type === "income" && t.date === dayStr).reduce((a, b) => a + Number(b.amount), 0);
      const expense = transactions.filter((t) => t.type === "expense" && !t.isInstallment && !t.isLoan && t.date === dayStr).reduce((a, b) => a + Number(b.amount), 0);
      const installment = transactions.filter((t) => t.isInstallment && t.date === dayStr).reduce((a, b) => a + Number(b.amount), 0);
      const loan = transactions.filter((t) => t.isLoan && t.date === dayStr).reduce((a, b) => a + Number(b.amount), 0);

      points.push({ label: `${day}`, income, expense, installment, loan });
    }
    return points;
  }, [selectedYear, selectedMonth, currentMonthKey, transactions]);

  const maxChartVal = Math.max(...chartData.map((d) => Math.max(d.income, d.expense, d.installment, d.loan)), 100000);
  const svgWidth = 700;
  const svgHeight = 160;
  const paddingX = 25;
  const paddingY = 25;

  const pointsCoords = useMemo(() => {
    const total = chartData.length;
    if (total === 0) return { inc: [], exp: [], inst: [], ln: [] };
    
    const getPts = (key: "income" | "expense" | "installment" | "loan") =>
      chartData.map((item, i) => {
        const x = paddingX + (i / (total - 1 || 1)) * (svgWidth - paddingX * 2);
        const ratio = item[key] / maxChartVal;
        const y = svgHeight - paddingY - ratio * (svgHeight - paddingY * 2);
        return { x, y, ...item };
      });

    return { inc: getPts("income"), exp: getPts("expense"), inst: getPts("installment"), ln: getPts("loan") };
  }, [chartData, maxChartVal, svgWidth, svgHeight]);

  // ==========================================
  // 7. MANEJADORES DE ACCIÓN Y ESCÁNER OCR
  // ==========================================
  const handleOpenCreate = (type: "expense" | "income" = "expense") => {
    setEditingId(null);
    setScannedImages([]);
    setActivePageIndex(0);
    setFormType(type);
    setIsFiscalInvoice(true);
    setFormDocType("Factura");
    setFormAmountInput("");
    setFormDescription("");
    setFormCategory(type === "expense" ? "Alimentación / Supermercado" : "Bono / Ingreso Extra");
    setFormCounterparty("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormDocNumber("");
    setFormCdc("");
    setFormIsMyExpense(true);
    setIsInstallment(false);
    setInstallmentTotal("12");
    setInstallmentInterest("0");
    setIsLoan(false);
    setFormGravada10("");
    setFormGravada5("");
    setFormExenta("");
    setShowModal(true);
  };

  const handleOpenEdit = (item: TransactionItem) => {
    setEditingId(item.id);
    setScannedImages(item.receiptImages || []);
    setActivePageIndex(0);
    setFormType(item.type);
    setIsFiscalInvoice(item.isFiscalInvoice ?? true);
    setFormDocType(item.docType || "Factura");
    setFormAmountInput(formatPYG(item.amount));
    setFormDescription(item.description || "");
    setFormCategory(item.categoryId || "Otros Gastos");
    setFormCounterparty(item.counterpartyName || "");
    setFormDate(item.date || new Date().toISOString().split("T")[0]);
    setFormDocNumber(item.documentNumber || "");
    setFormCdc(item.cdc || "");
    setFormIsMyExpense(item.isMyExpense !== false);
    setIsInstallment(item.isInstallment ?? false);
    setInstallmentTotal(String(item.installmentTotal || 12));
    setInstallmentInterest(String(item.interestRate || 0));
    setIsLoan(item.isLoan ?? false);
    setFormGravada10(item.gravada10 ? formatPYG(item.gravada10) : "");
    setFormGravada5(item.gravada5 ? formatPYG(item.gravada5) : "");
    setFormExenta(item.exenta ? formatPYG(item.exenta) : "");
    setShowModal(true);
  };

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("https://virucheck-api.onrender.com/process", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Error procesando");

      const docData: ExtractedDocInfo = await res.json();
      
      if (docData.images && docData.images.length > 0) {
        setScannedImages(docData.images);
        setActivePageIndex(0);
      }

      setEditingId(null);
      setFormType(docData.financialType || "expense");
      setIsFiscalInvoice(true);
      setFormDocType(docData.docType || "Factura");
      setFormAmountInput(formatPYG(docData.amount));
      setFormDescription(docData.productDetail || "Comprobante Escaneado");
      setFormCategory(docData.category || "Otros Gastos");
      setFormCounterparty(docData.businessName || "Comercio Emisor");
      setFormDate(docData.date || new Date().toISOString().split("T")[0]);
      setFormDocNumber(docData.documentNumber || "");
      setFormCdc(docData.cdc || "");
      setFormIsMyExpense(true);
      setFormGravada10(docData.gravada10 ? formatPYG(docData.gravada10) : "");
      setFormGravada5(docData.gravada5 ? formatPYG(docData.gravada5) : "");
      setFormExenta(docData.exenta ? formatPYG(docData.exenta) : "");
      setShowModal(true);
    } catch (err) {
      console.error(err);
      alert("Error al procesar el archivo mediante IA.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmt = parsePYG(formAmountInput);
    if (!user?.uid || cleanAmt <= 0 || !formDescription.trim()) return;

    setIsSubmitting(true);
    try {
      const basePayload: Record<string, any> = {
        userId: user.uid,
        amount: cleanAmt,
        currency: "PYG",
        type: formType,
        isFiscalInvoice,
        docType: isFiscalInvoice ? formDocType : "Gasto Común",
        categoryId: formCategory,
        description: formDescription.trim(),
        counterpartyName: formCounterparty.trim() || "Comercio Emisor",
        date: formDate,
        documentNumber: formDocNumber.trim() || "S/N",
        cdc: formCdc.trim() || "",
        isMyExpense: formIsMyExpense,
        isInstallment: Boolean(isInstallment),
        isLoan: Boolean(isLoan),
        interestRate: isInstallment ? parseFloat(installmentInterest) || 0 : 0,
        gravada10: parsePYG(formGravada10) || 0,
        gravada5: parsePYG(formGravada5) || 0,
        exenta: parsePYG(formExenta) || 0,
        receiptImages: scannedImages,
      };

      if (isInstallment) {
        basePayload.installmentCurrent = 1;
        basePayload.installmentTotal = parseInt(installmentTotal) || 12;
        basePayload.isPaid = false;
      }

      if (isLoan) {
        basePayload.loanRemainingBalance = cleanAmt;
      }

      if (editingId) {
        await updateDoc(doc(db, "transactions", editingId), {
          ...basePayload,
          updatedAt: serverTimestamp(),
        });
      } else {
        if (isInstallment) {
          const totalInst = parseInt(installmentTotal) || 12;
          const monthlyAmount = cleanAmt / totalInst;
          const [y, m, d] = formDate.split("-").map(Number);

          for (let i = 1; i <= totalInst; i++) {
            const instDateObj = new Date(y, (m - 1) + (i - 1), d || 1);
            const instDateStr = instDateObj.toISOString().split("T")[0];

            await addDoc(collection(db, "transactions"), {
              ...basePayload,
              amount: monthlyAmount,
              installmentCurrent: i,
              installmentTotal: totalInst,
              description: `${formDescription.trim()} (Cuota ${i}/${totalInst})`,
              date: instDateStr,
              isPaid: i === 1,
              createdAt: serverTimestamp(),
            });
          }
        } else {
          await addDoc(collection(db, "transactions"), {
            ...basePayload,
            createdAt: serverTimestamp(),
          });
        }
      }

      setShowModal(false);
      setScannedImages([]);
    } catch (err) {
      console.error("Error al guardar en Firebase:", err);
      alert("No se pudo guardar el registro. Revisa la consola.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!user?.uid || !itemToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "transactions", itemToDelete.id));
      setItemToDelete(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const exportToExcel = () => {
    if (filteredList.length === 0) {
      alert("No hay registros para exportar.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,Fecha;Tipo;Concepto;Categoria;Emisor;Monto (PYG)\r\n";
    filteredList.forEach(t => {
      csvContent += `${t.date};${t.type};"${t.description}";"${t.categoryId}";"${t.counterpartyName || ""}";${t.amount}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Movimientos_${selectedYear}_${selectedMonth + 1}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadImage = (imgSrc: string) => {
    const link = document.createElement("a");
    link.href = imgSrc;
    link.download = `Comprobante_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const shortMonthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
  const availableYears = Array.from({ length: 16 }, (_, i) => 2020 + i);

  // ==========================================
  // 9. RENDERIZADO VISUAL PROFESIONAL
  // ==========================================
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-28 md:pb-12 px-4 sm:px-6 animate-in fade-in duration-300">
      
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={handleFileScan} className="hidden" />

      <SyncMailModal
        isOpen={showSyncMailModal}
        onClose={() => setShowSyncMailModal(false)}
        userEmail={user?.email || ""}
        onSyncComplete={(newTransactions) => console.log(newTransactions)}
      />

      {/* CABECERA CON BOTONES MODERNOS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/60 pb-6 pt-2">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold tracking-wide uppercase shadow-sm">
            <Sparkles className="h-3.5 w-3.5" /> Módulo Financiero Avanzado
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            Libro de Movimientos y Cuotas
          </h1>
          <p className="text-xs text-slate-400">
            Control de ingresos, egresos, facturas fiscales, cuotas con check y préstamos bancarios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button size="sm" onClick={exportToExcel} className="h-10 px-4 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white text-xs font-bold gap-2 transition-all shadow-sm">
            <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
          </Button>

          <Button size="sm" onClick={() => setShowSyncMailModal(true)} className="h-10 px-4 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600 hover:text-white text-xs font-bold gap-2 transition-all shadow-sm">
            <Mail className="h-4 w-4" /> Sincronizar Correo
          </Button>

          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isScanning} className="h-10 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:brightness-110 text-white text-xs font-bold gap-2 shadow-lg shadow-blue-500/25 transition-all">
            {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            <span>{isScanning ? "Analizando IA..." : "Escanear Documento"}</span>
          </Button>

          <Button size="sm" onClick={() => handleOpenCreate("expense")} className="h-10 px-5 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:brightness-110 text-white text-xs font-extrabold gap-2 shadow-lg shadow-rose-600/30 transition-all">
            <PlusCircle className="h-4 w-4" /> Nuevo Movimiento
          </Button>
        </div>
      </div>

      {/* SELECTOR DE CALENDARIO MODERNO */}
      <div className="relative z-50 bg-slate-900/90 p-4 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button size="sm" variant="outline" onClick={() => setShowDatePicker(!showDatePicker)} className="h-10 px-4 rounded-2xl border-slate-700 bg-slate-950 text-xs font-bold text-slate-200 hover:text-cyan-400 hover:border-cyan-500/40 gap-2.5 transition-all">
            <CalendarIcon className="h-4 w-4 text-cyan-400" />
            <span>{monthNames[selectedMonth]} {selectedYear}</span>
          </Button>

          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-2xl border border-slate-800">
            <Button size="icon" variant="ghost" onClick={() => { if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(prev => prev - 1); } else { setSelectedMonth(prev => prev - 1); } }} className="h-7 w-7 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-mono font-bold text-slate-200 px-2 min-w-[90px] text-center">
              {shortMonthNames[selectedMonth]} {selectedYear}
            </span>
            <Button size="icon" variant="ghost" onClick={() => { if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(prev => prev + 1); } else { setSelectedMonth(selectedMonth + 1); } }} className="h-7 w-7 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showDatePicker && (
          <div className="mt-4 p-5 rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl z-[100] absolute top-full left-0 w-full sm:w-80 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Seleccionar Periodo</span>
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="h-8 rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs text-cyan-400 font-bold font-mono outline-none">
                {availableYears.map(yr => (<option key={yr} value={yr}>{yr}</option>))}
              </select>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {shortMonthNames.map((name, idx) => (
                <button key={name} onClick={() => { setSelectedMonth(idx); setShowDatePicker(false); }} className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${idx === selectedMonth ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg" : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"}`}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TARJETAS RESUMEN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Total Ingresos del Mes</span>
            <div className="rounded-2xl bg-emerald-500/10 p-2.5 text-emerald-400 border border-emerald-500/20"><ArrowUpRight className="h-4 w-4" /></div>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
            +{formatPYG(totalIncomes)} ₲
          </div>
        </div>

        <div className="rounded-3xl border border-rose-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/30 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Total Gastos y Cuotas</span>
            <div className="rounded-2xl bg-rose-500/10 p-2.5 text-rose-400 border border-rose-500/20"><ArrowDownRight className="h-4 w-4" /></div>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-black text-rose-400 font-mono">
            -{formatPYG(totalExpenses)} ₲
          </div>
        </div>
      </div>

      {/* GRÁFICO EXTENDIDO */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400 animate-pulse" />
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider">
                Evolución Analítica Contable
              </h3>
              <p className="text-[10px] text-slate-400">Ingresos, Gastos Comunes, Cuotas y Préstamos</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold">
            <span className="flex items-center gap-1 text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-500"></span> Ingresos</span>
            <span className="flex items-center gap-1 text-rose-400"><span className="h-2 w-2 rounded-full bg-rose-500"></span> Gastos</span>
            <span className="flex items-center gap-1 text-amber-400"><span className="h-2 w-2 rounded-full bg-amber-500"></span> Cuotas</span>
            <span className="flex items-center gap-1 text-purple-400"><span className="h-2 w-2 rounded-full bg-purple-500"></span> Préstamos</span>
          </div>
        </div>

        <div className="overflow-x-auto pb-2 pt-2">
          <div className="min-w-[650px] relative">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-44 overflow-visible">
              <defs>
                <linearGradient id="lInc" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#34d399" /></linearGradient>
                <linearGradient id="lExp" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#f43f5e" /><stop offset="100%" stopColor="#fb7185" /></linearGradient>
                <linearGradient id="lInst" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#fbbf24" /></linearGradient>
                <linearGradient id="lLn" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#a855f7" /><stop offset="100%" stopColor="#c084fc" /></linearGradient>
              </defs>

              {pointsCoords.inc.length > 1 && <path d={pointsCoords.inc.reduce((acc, pt, i, arr) => i === 0 ? `M ${pt.x},${pt.y}` : `${acc} C ${(arr[i-1].x+pt.x)/2},${arr[i-1].y} ${(arr[i-1].x+pt.x)/2},${pt.y} ${pt.x},${pt.y}`, "")} fill="none" stroke="url(#lInc)" strokeWidth="2.5" />}
              {pointsCoords.exp.length > 1 && <path d={pointsCoords.exp.reduce((acc, pt, i, arr) => i === 0 ? `M ${pt.x},${pt.y}` : `${acc} C ${(arr[i-1].x+pt.x)/2},${arr[i-1].y} ${(arr[i-1].x+pt.x)/2},${pt.y} ${pt.x},${pt.y}`, "")} fill="none" stroke="url(#lExp)" strokeWidth="2.5" />}
              {pointsCoords.inst.length > 1 && <path d={pointsCoords.inst.reduce((acc, pt, i, arr) => i === 0 ? `M ${pt.x},${pt.y}` : `${acc} C ${(arr[i-1].x+pt.x)/2},${arr[i-1].y} ${(arr[i-1].x+pt.x)/2},${pt.y} ${pt.x},${pt.y}`, "")} fill="none" stroke="url(#lInst)" strokeWidth="2.5" />}
              {pointsCoords.ln.length > 1 && <path d={pointsCoords.ln.reduce((acc, pt, i, arr) => i === 0 ? `M ${pt.x},${pt.y}` : `${acc} C ${(arr[i-1].x+pt.x)/2},${arr[i-1].y} ${(arr[i-1].x+pt.x)/2},${pt.y} ${pt.x},${pt.y}`, "")} fill="none" stroke="url(#lLn)" strokeWidth="2.5" />}
            </svg>

            <div className="flex justify-between px-4 pt-2 border-t border-slate-800/80">
              {chartData.map((d, i) => (<span key={i} className="text-[10px] text-slate-500 font-mono text-center flex-1">{d.label}</span>))}
            </div>
          </div>
        </div>
      </div>

      {/* LISTADO DE MOVIMIENTOS CON CHECK DE CUOTAS Y EDICIÓN */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-2xl shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-blue-400" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100">Registro General de Movimientos y Cuotas</h3>
              <p className="text-[11px] text-slate-400">Mostrando {filteredList.length} registros del periodo</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:w-44">
              <Search className="absolute left-3.5 top-3 h-3.5 w-3.5 text-slate-500" />
              <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-10 pl-9 text-xs rounded-2xl border-slate-800 bg-slate-950 text-slate-100 shadow-inner" />
            </div>

            <Button size="sm" variant="outline" onClick={() => setSortOrder((p) => (p === "desc" ? "asc" : "desc"))} className="h-10 px-4 rounded-2xl border-slate-800 bg-slate-950 text-xs font-bold text-slate-300 hover:text-white">
              <ArrowUpDown className="h-3.5 w-3.5 text-blue-400 mr-1.5" />
              {sortOrder === "desc" ? "Nuevos" : "Antiguos"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center items-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
        ) : filteredList.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-3xl space-y-2 bg-slate-950/30">
            <p className="font-bold text-slate-300">No hay movimientos en esta sección.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {paginatedList.map((item) => {
              const imgs = item.receiptImages || [];
              const isInc = item.type === "income";

              return (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-3 hover:bg-slate-950/60 px-3 rounded-2xl transition-all border border-transparent hover:border-slate-800/50">
                  <div className="flex items-start sm:items-center gap-3.5">
                    
                    {/* Check de Cuotas */}
                    {item.isInstallment && (
                      <button
                        type="button"
                        onClick={() => toggleInstallmentPaid(item)}
                        title={item.isPaid ? "Cuota Pagada" : "Cuota Pendiente"}
                        className={`h-6 w-6 rounded-xl border flex items-center justify-center transition-all shrink-0 font-bold ${
                          item.isPaid ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20" : "bg-slate-950 border-slate-700 text-transparent"
                        }`}
                      >
                        ✓
                      </button>
                    )}

                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl shrink-0 shadow-inner ${isInc ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                      {isInc ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-100 text-sm leading-snug">{item.description}</p>
                        
                        {item.isInstallment && (
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
                            Cuota {item.installmentCurrent}/{item.installmentTotal} {item.isPaid ? "(Pagado)" : "(Pendiente)"}
                          </span>
                        )}

                        {item.isLoan && (
                          <span className="px-2.5 py-0.5 rounded-lg bg-purple-500/10 text-purple-400 text-[10px] font-bold border border-purple-500/20">
                            Préstamo
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {item.counterpartyName || "Emisor"} • Categoría: <span className="text-cyan-400">{item.categoryId}</span> • Fecha: {item.date}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pl-14 sm:pl-0">
                    <span className={`font-mono font-black text-base sm:text-lg ${isInc ? "text-emerald-400" : "text-rose-400"}`}>
                      {isInc ? "+" : "-"}{formatPYG(item.amount)} ₲
                    </span>

                    <div className="flex items-center gap-1.5">
                      {imgs.length > 0 && (
                        <Button size="icon" variant="ghost" onClick={() => setZoomImageModal(imgs[0])} title="Ver PNG" className="h-9 w-9 text-cyan-400 hover:bg-cyan-500/10 rounded-xl">
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => handleOpenEdit(item)} title="Editar monto y datos" className="h-9 w-9 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl"><Edit3 className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setItemToDelete(item)} className="h-9 w-9 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl"><Trash2 className="h-4 w-4" /></Button>
                    </div>
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
              <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="h-8 px-3 rounded-xl border-slate-800 bg-slate-950 text-xs font-semibold text-slate-300">Anterior</Button>
              <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="h-8 px-3 rounded-xl border-slate-800 bg-slate-950 text-xs font-semibold text-slate-300">Siguiente</Button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CREAR / EDITAR CON CAMPOS FISCALES COMPLETOS Y CLASIFICACIÓN */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="border-b border-slate-800 bg-slate-950/80 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-white flex items-center gap-2.5">
                  <Sparkles className="h-5 w-5 text-cyan-400" /> {editingId ? "Modificar Movimiento" : "Registrar Comprobante / Movimiento"}
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 px-3 rounded-xl border-slate-700 bg-slate-950 text-[11px] text-cyan-400">
                  <RefreshCw className="h-3 w-3 mr-1" /> Escanear Archivo
                </Button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              
              {scannedImages.length > 0 && (
                <div className="relative rounded-2xl border border-slate-800 bg-slate-950 p-3 flex flex-col items-center justify-center">
                  <div className="w-full flex items-center justify-between px-2 py-1 text-[11px] text-slate-400 border-b border-slate-800 mb-2.5">
                    <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
                      <Eye className="h-4 w-4" /> Página {activePageIndex + 1} de {scannedImages.length}
                    </span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => downloadImage(scannedImages[activePageIndex])} className="h-7 px-2 text-emerald-400 text-[11px] font-bold gap-1">
                      <Download className="h-3.5 w-3.5" /> Descargar PNG
                    </Button>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={scannedImages[activePageIndex]} alt="Comprobante" onClick={() => setZoomImageModal(scannedImages[activePageIndex])} className="max-h-48 object-contain rounded-xl border border-slate-800 cursor-zoom-in bg-white" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Tipo de Operación</Label>
                  <select value={formType} onChange={(e) => setFormType(e.target.value as any)} className={`w-full h-11 rounded-2xl border px-4 text-xs font-bold outline-none ${formType === "income" ? "border-emerald-500/50 bg-emerald-950/30 text-emerald-300" : "border-rose-500/50 bg-rose-950/30 text-rose-300"}`}>
                    <option value="expense">Gasto / Egreso</option>
                    <option value="income">Ingreso / Entrada</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Clasificación del Gasto</Label>
                  <select
                    value={isFiscalInvoice ? "fiscal" : "common"}
                    onChange={(e) => {
                      const val = e.target.value === "fiscal";
                      setIsFiscalInvoice(val);
                    }}
                    className="w-full h-11 rounded-2xl border border-slate-800 bg-slate-950 px-4 text-xs text-slate-100 outline-none font-medium"
                  >
                    <option value="fiscal">Factura Fiscal (Con CDC / RUC)</option>
                    <option value="common">Gasto Común / Sin Comprobante</option>
                  </select>
                </div>
              </div>

              {/* Monto con teclado numérico nativo */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-bold">Monto Total (PYG ₲) *</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  required
                  value={formAmountInput}
                  onChange={(e) => setFormAmountInput(e.target.value)}
                  onBlur={() => {
                    const parsed = parsePYG(formAmountInput);
                    if (parsed > 0) setFormAmountInput(formatPYG(parsed));
                  }}
                  placeholder="Ej: 150000"
                  className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 font-black text-base px-4 font-mono"
                />
              </div>

              {/* SELECCIÓN DUAL: CUOTAS Y PRÉSTAMOS */}
              {formType === "expense" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300 flex items-center gap-1.5 text-[11px]"><CreditCard className="h-4 w-4" /> En Cuotas Mes a Mes</span>
                      <input type="checkbox" checked={isInstallment} onChange={(e) => setIsInstallment(e.target.checked)} className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-amber-500 cursor-pointer" />
                    </div>
                    {isInstallment && (
                      <div className="space-y-2 pt-2 border-t border-amber-500/20">
                        <div>
                          <Label className="text-[10px] text-amber-200">Total de Meses / Plazos</Label>
                          <Input type="number" inputMode="numeric" min={2} max={60} value={installmentTotal} onChange={(e) => setInstallmentTotal(e.target.value)} className="h-8 rounded-xl border-slate-800 bg-slate-950 text-amber-300 font-mono text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-amber-200">% Interés por Mora (Opcional)</Label>
                          <Input type="number" inputMode="numeric" min={0} max={100} value={installmentInterest} onChange={(e) => setInstallmentInterest(e.target.value)} placeholder="Ej: 5" className="h-8 rounded-xl border-slate-800 bg-slate-950 text-amber-300 font-mono text-xs" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-300 flex items-center gap-1.5 text-[11px]"><Percent className="h-4 w-4" /> Es Préstamo</span>
                      <input type="checkbox" checked={isLoan} onChange={(e) => setIsLoan(e.target.checked)} className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-purple-500 cursor-pointer" />
                    </div>
                    {isLoan && (
                      <div className="pt-2 border-t border-purple-500/20">
                        <p className="text-[10px] text-slate-300">Usa el monto principal como saldo del préstamo.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Campos fiscales opcionales condicionales */}
              {formType === "expense" && isFiscalInvoice && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1"><Label className="text-[10px] text-slate-400 font-bold">Gravada 10%</Label><Input inputMode="numeric" value={formGravada10} onChange={(e) => setFormGravada10(e.target.value)} className="h-9 rounded-xl border-slate-800 bg-slate-950 text-slate-200 text-xs px-3 font-mono" /></div>
                    <div className="space-y-1"><Label className="text-[10px] text-slate-400 font-bold">Gravada 5%</Label><Input inputMode="numeric" value={formGravada5} onChange={(e) => setFormGravada5(e.target.value)} className="h-9 rounded-xl border-slate-800 bg-slate-950 text-slate-200 text-xs px-3 font-mono" /></div>
                    <div className="space-y-1"><Label className="text-[10px] text-slate-400 font-bold">Exenta</Label><Input inputMode="numeric" value={formExenta} onChange={(e) => setFormExenta(e.target.value)} className="h-9 rounded-xl border-slate-800 bg-slate-950 text-slate-200 text-xs px-3 font-mono" /></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs text-slate-300 font-bold">Local / Emisor</Label><Input value={formCounterparty} onChange={(e) => setFormCounterparty(e.target.value)} placeholder="Ej. Supermercado" className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs px-4" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-slate-300 font-bold">N° de Documento</Label><Input value={formDocNumber} onChange={(e) => setFormDocNumber(e.target.value)} placeholder="001-001-0000001" className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs px-4 font-mono" /></div>
                  </div>

                  <div className="space-y-1.5"><Label className="text-xs text-slate-300 font-bold">Código CDC (Factura Electrónica)</Label><Input value={formCdc} onChange={(e) => setFormCdc(e.target.value)} placeholder="01003798..." className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs px-4 font-mono" /></div>
                </>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-bold">Detalle / Concepto Amplio *</Label>
                <textarea required rows={3} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Describe detalladamente el concepto..." className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-100 outline-none resize-none font-medium" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs text-slate-300 font-bold">Fecha de Emisión</Label><Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs px-4 font-mono" /></div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Categoría</Label>
                  <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full h-11 rounded-2xl border border-slate-800 bg-slate-950 px-4 text-xs text-slate-100 outline-none">
                    {(formType === "expense" ? CATEGORIES_EXPENSE.map(c => c.id) : CATEGORIES_INCOME).map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="rounded-xl border-slate-700 text-xs text-slate-300 h-10 px-4">Cancelar</Button>
                <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white h-10 px-6">Confirmar y Guardar</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ZOOM */}
      {zoomImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full h-full overflow-auto flex flex-col items-center justify-center p-4">
            <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
              <Button onClick={() => downloadImage(zoomImageModal)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold gap-2"><Download className="h-4 w-4" /> Descargar PNG</Button>
              <Button onClick={() => setZoomImageModal(null)} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold">Cerrar ✕</Button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoomImageModal} alt="Zoom" className="max-w-[95vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-slate-700 bg-white my-auto scale-110 origin-center" />
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in zoom-in-95">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0"><AlertTriangle className="h-6 w-6" /></div>
              <div className="space-y-0.5"><h3 className="text-base font-bold text-slate-100">¿Eliminar registro?</h3><p className="text-xs text-slate-400">Esta acción actualizará tu balance contable.</p></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setItemToDelete(null)} className="rounded-xl border-slate-700 text-xs text-slate-300">Cancelar</Button>
              <Button size="sm" disabled={isDeleting} onClick={confirmDelete} className="rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs text-white px-5">Eliminar</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}