"use client";

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
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ReceiptText,
  TrendingDown,
  TrendingUp,
  PlusCircle,
  Search,
  ArrowUpDown,
  Trash2,
  Edit3,
  Building,
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
  Calendar,
  KeyRound,
  ExternalLink,
  Download,
  FileSpreadsheet,
} from "lucide-react";

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
  { id: "Otros Gastos", icon: Tag },
];

const CATEGORIES_INCOME = [
  { id: "Salario", icon: Building },
  { id: "Ingreso Extra", icon: Zap },
  { id: "Cobro por Servicios / Ventas", icon: Tag },
  { id: "Cobro de Alquiler", icon: Home },
  { id: "Otros Ingresos", icon: Tag },
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

export default function MovimientosPage() {
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Pestañas principales: Facturas Propias, Facturas de Terceros, Recibos
  const [activeTab, setActiveTab] = useState<"propias" | "terceros" | "recibos">("propias");

  // Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Paginación
  const [itemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal Crear / Editar
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Escáner e Imágenes Múltiples con Zoom
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusMessage, setScanStatusMessage] = useState("");
  const [scannedImages, setScannedImages] = useState<string[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [zoomImageModal, setZoomImageModal] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sincronización de Correo
  const [isSyncingMail, setIsSyncingMail] = useState(false);
  const [syncPeriod, setSyncPeriod] = useState<"30" | "60" | "custom">("60");
  const [customStartDate, setCustomStartDate] = useState(
    new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [showMailAuthModal, setShowMailAuthModal] = useState(false);
  const [appPasswordInput, setAppPasswordInput] = useState("");
  const [documentNumberInput, setDocumentNumberInput] = useState("");

  // Modal Confirmación de Eliminación
  const [itemToDelete, setItemToDelete] = useState<TransactionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Filtrado según la pestaña activa
  const filteredList = useMemo(() => {
    let result = transactions.filter((t) => {
      const isRecibo = (t.docType || "").toLowerCase().includes("recibo");
      const isMyExp = t.isMyExpense !== false;

      if (activeTab === "recibos") return isRecibo;
      if (activeTab === "terceros") return !isRecibo && !isMyExp;
      return !isRecibo && isMyExp; // Pestaña predeterminada: Facturas Propias
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
  }, [transactions, activeTab, searchTerm, sortOrder]);

  // IMPORTANTE: Para el Dashboard y el Balance, solo sumamos los ingresos y los gastos donde "isMyExpense !== false" (Gastos Propios)
  const myTransactions = useMemo(
    () => transactions.filter((t) => t.isMyExpense !== false),
    [transactions]
  );

  const totalIncomes = useMemo(
    () => myTransactions.filter((t) => t.type === "income").reduce((acc, t) => acc + (Number(t.amount) || 0), 0),
    [myTransactions]
  );
  const totalExpenses = useMemo(
    () => myTransactions.filter((t) => t.type === "expense").reduce((acc, t) => acc + (Number(t.amount) || 0), 0),
    [myTransactions]
  );
  const currentBalance = totalIncomes - totalExpenses;

  // Cálculo de IVA para Marangato (solo de facturas propias)
  const marangatoTaxSummary = useMemo(() => {
    const facturasPropias = myTransactions.filter(
      (t) => !(t.docType || "").toLowerCase().includes("recibo")
    );
    let totalGravada10 = 0;
    let totalGravada5 = 0;

    facturasPropias.forEach((t) => {
      totalGravada10 += Number(t.gravada10 || 0);
      totalGravada5 += Number(t.gravada5 || 0);
    });

    return {
      iva10: totalGravada10 / 11,
      iva5: totalGravada5 / 21,
      totalIva: (totalGravada10 / 11) + (totalGravada5 / 21),
    };
  }, [myTransactions]);

  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredList.slice(start, start + itemsPerPage);
  }, [filteredList, currentPage, itemsPerPage]);

  const handleOpenCreate = (type: "expense" | "income" = "expense") => {
    setEditingId(null);
    setScannedImages([]);
    setActivePageIndex(0);
    setFormType(type);
    setFormDocType("Factura");
    setFormAmountInput("");
    setFormDescription("");
    setFormCategory(type === "expense" ? "Alimentación / Supermercado" : "Ingreso Extra");
    setFormCounterparty("");
    setFormPaymentMethod("Transferencia");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormDocNumber("");
    setFormCdc("");
    setFormIsMyExpense(true);
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
    setFormDocType(item.docType || "Factura");
    setFormAmountInput(formatPYG(item.amount));
    setFormDescription(item.description || "");
    setFormCategory(item.categoryId || "Otros Gastos");
    setFormCounterparty(item.counterpartyName || "");
    setFormPaymentMethod(item.paymentMethod || "Transferencia");
    setFormDate(item.date || new Date().toISOString().split("T")[0]);
    setFormDocNumber(item.documentNumber || "");
    setFormCdc(item.cdc || "");
    setFormIsMyExpense(item.isMyExpense !== false);
    setFormGravada10(item.gravada10 ? formatPYG(item.gravada10) : "");
    setFormGravada5(item.gravada5 ? formatPYG(item.gravada5) : "");
    setFormExenta(item.exenta ? formatPYG(item.exenta) : "");
    setShowModal(true);
  };

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanStatusMessage("Convirtiendo PDF/Imagen a PNG y extrayendo datos con IA...");

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
      setFormDate(docData.date || new Date().toISOString().split("T")[0]);
      setFormDocNumber(docData.documentNumber || "001-001-0000001");
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

  const exportToExcel = () => {
    const facturas = myTransactions.filter(t => !(t.docType || "").toLowerCase().includes("recibo"));
    if (facturas.length === 0) {
      alert("No hay facturas propias para exportar.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,Fecha;Tipo Doc;N° Documento;CDC;Emisor;Concepto;Monto Total (PYG);Gravada 10%;Gravada 5%;Exenta;IVA 10%\r\n";

    facturas.forEach(t => {
      const g10 = t.gravada10 || 0;
      const g5 = t.gravada5 || 0;
      const ex = t.exenta || 0;
      const iva10 = g10 / 11;
      csvContent += `${t.date};${t.docType || "Factura"};${t.documentNumber || "S/N"};${t.cdc || ""};${t.counterpartyName || ""};${t.description};${t.amount};${g10};${g5};${ex};${iva10.toFixed(0)}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Facturas_Marangato_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadImage = (imgSrc: string) => {
    const link = document.createElement("a");
    link.href = imgSrc;
    link.download = `Comprobante_${formDocNumber || "documento"}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmt = parsePYG(formAmountInput);
    if (!user?.uid || cleanAmt <= 0 || !formDescription.trim()) return;

    setIsSubmitting(true);
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
        documentNumber: formDocNumber.trim() || "001-001-0000001",
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

  const executeMailSync = async (emailAddr: string, appPass: string, docNum: string) => {
    setIsSyncingMail(true);
    try {
      const payload: any = { email: emailAddr, password: appPass, documentNumber: docNum || "5265619" };
      if (syncPeriod === "custom") {
        payload.startDate = customStartDate;
        payload.endDate = customEndDate;
      } else {
        payload.days = parseInt(syncPeriod, 10);
      }

      const res = await fetch("/api/sync-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.transactions && data.transactions.length > 0) {
        let addedCount = 0;
        for (const item of data.transactions) {
          if (!user?.uid || !item.amount) continue;
          const isDuplicate = transactions.some(
            (t) => Number(t.amount) === Number(item.amount) && t.date === item.date && t.documentNumber === item.documentNumber
          );

          if (!isDuplicate) {
            await addDoc(collection(db, "transactions"), {
              userId: user.uid,
              amount: Number(item.amount),
              currency: "PYG",
              type: "expense",
              docType: item.docType || "Factura",
              categoryId: item.category || "Otros Gastos",
              description: item.productDetail || `${item.docType} de ${item.businessName}`,
              counterpartyName: item.businessName || "Comercio",
              paymentMethod: "Transferencia",
              date: item.date || new Date().toISOString().split("T")[0],
              documentNumber: item.documentNumber || "001-001-0000001",
              cdc: item.cdc || "",
              isMyExpense: true,
              gravada10: Number(item.gravada10 || item.amount),
              gravada5: Number(item.gravada5 || 0),
              exenta: Number(item.exenta || 0),
              receiptImages: item.images || [],
              createdAt: serverTimestamp(),
            });
            addedCount++;
          }
        }
        alert(`✨ Sincronización completa: ${addedCount} documentos nuevos añadidos desde tu correo.`);
      } else {
        alert(data.error ? `Aviso: ${data.error}` : "No se encontraron nuevos comprobantes.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al conectar con el servidor de correo.");
    } finally {
      setIsSyncingMail(false);
    }
  };

  const handleStartMailSync = async () => {
    if (!user?.uid || !user?.email) return;
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists() && userSnap.data().mailAppPassword) {
        await executeMailSync(user.email, userSnap.data().mailAppPassword, userSnap.data().documentNumber || "");
      } else {
        setShowMailAuthModal(true);
      }
    } catch (e) {
      setShowMailAuthModal(true);
    }
  };

  const handleSaveAppPasswordAndSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !user?.email || !appPasswordInput.trim()) return;
    try {
      const cleanPass = appPasswordInput.replace(/\s+/g, "").trim();
      const cleanDoc = documentNumberInput.trim() || "5265619";
      await setDoc(doc(db, "users", user.uid), { mailAppPassword: cleanPass, documentNumber: cleanDoc }, { merge: true });
      setShowMailAuthModal(false);
      await executeMailSync(user.email, cleanPass, cleanDoc);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-28 md:pb-12 px-4 sm:px-6 animate-in fade-in duration-300">
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.docx" onChange={handleFileScan} className="hidden" />

      {/* 1. CABECERA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/60 pb-6 pt-2">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-semibold tracking-wide uppercase">
            <Sparkles className="h-3 w-3" /> Gestión Fiscal y Contable de Facturas
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            Libro de Movimientos
          </h1>
          <p className="text-xs text-slate-400">
            Control de facturas propias, de terceros, recibos, cálculo de IVA para Marangato y exportación a Excel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="sm"
            onClick={exportToExcel}
            className="h-10 px-4 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white text-xs font-bold gap-2 transition-all"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Exportar Excel (Marangato)</span>
          </Button>

          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
            className="h-10 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:brightness-110 text-white text-xs font-bold gap-2 shadow-lg shadow-blue-500/25 transition-all"
          >
            {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            <span>{isScanning ? "Procesando..." : "Escanear Documento"}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenCreate("expense")}
            className="h-10 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold gap-2 shadow-lg shadow-rose-600/25 transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            Nuevo Gasto
          </Button>
        </div>
      </div>

      {/* BANNER DE RESUMEN IVA MARANGATO (Basado en Gastos Propios) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-3xl border border-blue-500/30 bg-blue-950/40 p-5 backdrop-blur-md shadow-lg space-y-1">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-300">IVA 10% Crédito</span>
          <p className="text-xl font-black text-blue-400 font-mono">{formatPYG(marangatoTaxSummary.iva10)} ₲</p>
        </div>
        <div className="rounded-3xl border border-blue-500/30 bg-blue-950/40 p-5 backdrop-blur-md shadow-lg space-y-1">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-300">IVA 5% Crédito</span>
          <p className="text-xl font-black text-blue-400 font-mono">{formatPYG(marangatoTaxSummary.iva5)} ₲</p>
        </div>
        <div className="rounded-3xl border border-blue-500/30 bg-blue-950/40 p-5 backdrop-blur-md shadow-lg space-y-1">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-300">Total IVA Crédito</span>
          <p className="text-xl font-black text-cyan-400 font-mono">{formatPYG(marangatoTaxSummary.totalIva)} ₲</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md shadow-lg space-y-1">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Balance Neto (Propios)</span>
          <p className={`text-xl font-black font-mono ${currentBalance >= 0 ? "text-slate-100" : "text-rose-400"}`}>
            {formatPYG(currentBalance)} ₲
          </p>
        </div>
      </div>

      {/* PANEL DE SINCRONIZACIÓN DE CORREO */}
      <div className="relative overflow-hidden rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-950/60 via-slate-900/90 to-indigo-950/50 p-6 backdrop-blur-xl shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30 shrink-0 shadow-inner">
              <Mail className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-white font-bold text-base flex items-center gap-2">
                Sincronización Automática con Gmail <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px]">IMAP</span>
              </h4>
              <p className="text-slate-300 text-xs leading-relaxed max-w-xl">
                Extrae y convierte automáticamente todas las facturas de tu bandeja para <b className="text-blue-400">{user?.email}</b>.
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            disabled={isSyncingMail}
            onClick={handleStartMailSync}
            className="h-11 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs gap-2 shadow-lg shadow-blue-600/30 transition-all shrink-0"
          >
            {isSyncingMail ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>{isSyncingMail ? "Sincronizando..." : "Sincronizar Facturas del Correo"}</span>
          </Button>
        </div>
      </div>

      {/* MODAL CONFIGURAR CLAVE GMAIL */}
      {showMailAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden p-7 space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="p-3.5 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
                <KeyRound className="h-6 w-6" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-lg font-bold text-white">Conectar Gmail</h3>
                <p className="text-xs text-slate-400">{user?.email}</p>
              </div>
            </div>

            <form onSubmit={handleSaveAppPasswordAndSync} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-bold">Contraseña de Aplicación de Google (16 dígitos)</Label>
                <Input
                  type="password"
                  required
                  placeholder="ej: jiyx octy rcxn sgzt"
                  value={appPasswordInput}
                  onChange={(e) => setAppPasswordInput(e.target.value)}
                  className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 font-mono text-sm tracking-widest px-4"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-bold">N° de Cédula o RUC (para filtrar facturas)</Label>
                <Input
                  type="text"
                  required
                  placeholder="ej: 5265619"
                  value={documentNumberInput}
                  onChange={(e) => setDocumentNumberInput(e.target.value)}
                  className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs px-4 font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" onClick={() => setShowMailAuthModal(false)} className="rounded-xl border-slate-700 text-xs text-slate-300 h-10 px-4">
                  Cancelar
                </Button>
                <Button type="submit" className="rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white h-10 px-6">
                  Guardar y Sincronizar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PESTAÑAS PRINCIPALES: FACTURAS PROPIAS, TERCEROS Y RECIBOS */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab("propias")}
          className={`px-6 py-2.5 rounded-2xl font-bold text-xs transition-all shrink-0 ${
            activeTab === "propias" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" : "bg-slate-900 text-slate-400 hover:text-white"
          }`}
        >
          📄 Facturas Propias (Deducibles / Dashboard)
        </button>
        <button
          onClick={() => setActiveTab("terceros")}
          className={`px-6 py-2.5 rounded-2xl font-bold text-xs transition-all shrink-0 ${
            activeTab === "terceros" ? "bg-amber-600 text-white shadow-lg shadow-amber-600/30" : "bg-slate-900 text-slate-400 hover:text-white"
          }`}
        >
          👥 Facturas de Terceros (No Deducibles)
        </button>
        <button
          onClick={() => setActiveTab("recibos")}
          className={`px-6 py-2.5 rounded-2xl font-bold text-xs transition-all shrink-0 ${
            activeTab === "recibos" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" : "bg-slate-900 text-slate-400 hover:text-white"
          }`}
        >
          🧾 Recibos de Dinero
        </button>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTROS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-3xl border border-slate-800/80 backdrop-blur-xl shadow-lg">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Buscar por concepto, comercio, N° de documento (ej: 001-001...), CDC o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-10 text-xs rounded-2xl border-slate-800 bg-slate-950 text-slate-100 shadow-inner"
          />
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setSortOrder((p) => (p === "desc" ? "asc" : "desc"))}
          className="h-10 px-4 rounded-2xl border-slate-800 bg-slate-950 text-xs font-bold text-slate-300 hover:text-white"
        >
          <ArrowUpDown className="h-3.5 w-3.5 text-blue-400 mr-1.5" />
          {sortOrder === "desc" ? "Más Recientes" : "Más Antiguos"}
        </Button>
      </div>

      {/* LISTADO DE MOVIMIENTOS */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-5 sm:p-7 backdrop-blur-2xl shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <span className="text-xs font-extrabold text-slate-300 uppercase tracking-widest">
            {filteredList.length} Registros en {activeTab === "propias" ? "Facturas Propias" : activeTab === "terceros" ? "Facturas de Terceros" : "Recibos"}
          </span>
          <span className="text-xs font-mono text-slate-500">Página {currentPage} de {totalPages}</span>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-3xl space-y-2 bg-slate-950/30">
            <p className="font-bold text-slate-300">No hay registros en esta sección</p>
            <p className="text-slate-500">Escanea una factura o sincroniza tu correo para comenzar.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {paginatedList.map((item) => {
              const imgs = item.receiptImages || [];
              const isMyExp = item.isMyExpense !== false;

              return (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-3 hover:bg-slate-950/60 px-3 rounded-2xl transition-all border border-transparent hover:border-slate-800/50">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl shrink-0 shadow-inner bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <ReceiptText className="h-5 w-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-100 text-sm leading-snug">{item.description}</p>
                        <span className="px-2 py-0.5 rounded-md bg-blue-900/40 text-blue-300 text-[10px] font-bold border border-blue-500/20">
                          {item.docType || "Factura"}
                        </span>
                        {item.documentNumber && item.documentNumber !== "S/N" && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 text-[10px] font-mono font-bold">
                            N° {item.documentNumber}
                          </span>
                        )}
                        {!isMyExp && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
                            Gasto de Tercero
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <span className="text-slate-300">{item.counterpartyName || "Emisor"}</span>
                        <span>•</span>
                        <span>{item.date}</span>
                        {item.cdc && (
                          <>
                            <span>•</span>
                            <span className="text-cyan-400/80 truncate max-w-xs" title={item.cdc}>CDC: {item.cdc}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pl-14 sm:pl-0">
                    <span className="font-mono font-black text-base sm:text-lg text-slate-100">
                      {formatPYG(item.amount)} ₲
                    </span>

                    <div className="flex items-center gap-1.5">
                      {imgs.length > 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setZoomImageModal(imgs[0])}
                          title="Ver documento en PNG y hacer zoom"
                          className="h-9 w-9 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-xl transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => handleOpenEdit(item)} className="h-9 w-9 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-colors">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setItemToDelete(item)} className="h-9 w-9 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL FORMULARIO */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="border-b border-slate-800 bg-slate-950/80 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-white flex items-center gap-2.5">
                  <Sparkles className="h-5 w-5 text-cyan-400" />
                  {editingId ? "Modificar Comprobante" : "Registrar Comprobante Escaneado"}
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 px-3 rounded-xl border-slate-700 bg-slate-950 text-[11px] text-cyan-400">
                  <RefreshCw className="h-3 w-3 mr-1" /> Cambiar Archivo
                </Button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {/* VISOR DE PÁGINAS MÚLTIPLES PNG CON ZOOM Y DESCARGA */}
              {scannedImages.length > 0 && (
                <div className="relative rounded-2xl border border-slate-800 bg-slate-950 p-3 flex flex-col items-center justify-center">
                  <div className="w-full flex items-center justify-between px-2 py-1 text-[11px] text-slate-400 border-b border-slate-800 mb-2.5">
                    <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
                      <Eye className="h-4 w-4" /> Página {activePageIndex + 1} de {scannedImages.length}
                    </span>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => downloadImage(scannedImages[activePageIndex])}
                        className="h-7 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 text-[11px] font-bold gap-1"
                      >
                        <Download className="h-3.5 w-3.5" /> Descargar PNG
                      </Button>

                      {scannedImages.length > 1 && (
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="ghost" size="icon" disabled={activePageIndex === 0} onClick={() => setActivePageIndex((p) => Math.max(0, p - 1))} className="h-6 w-6 text-slate-300">
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" disabled={activePageIndex === scannedImages.length - 1} onClick={() => setActivePageIndex((p) => Math.min(scannedImages.length - 1, p + 1))} className="h-6 w-6 text-slate-300">
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={scannedImages[activePageIndex]}
                    alt={`Página ${activePageIndex + 1}`}
                    onClick={() => setZoomImageModal(scannedImages[activePageIndex])}
                    className="max-h-56 object-contain rounded-xl border border-slate-800 shadow-md cursor-zoom-in bg-white hover:opacity-95 transition-opacity"
                  />
                  <p className="text-[10px] text-slate-400 mt-2 font-mono">Haz clic en la imagen para abrir el visor con zoom detallado.</p>
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
                <Input
                  type="text"
                  required
                  value={formAmountInput}
                  onChange={(e) => setFormAmountInput(e.target.value)}
                  onBlur={() => {
                    const parsed = parsePYG(formAmountInput);
                    if (parsed > 0) setFormAmountInput(formatPYG(parsed));
                  }}
                  className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 font-black text-base px-4 font-mono"
                />
              </div>

              {/* CAMPOS DE IMPUESTOS (GRAVADA 10%, 5% Y EXENTA) */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-400 font-bold">Gravada 10%</Label>
                  <Input value={formGravada10} onChange={(e) => setFormGravada10(e.target.value)} className="h-9 rounded-xl border-slate-800 bg-slate-950 text-slate-200 text-xs px-3 font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-400 font-bold">Gravada 5%</Label>
                  <Input value={formGravada5} onChange={(e) => setFormGravada5(e.target.value)} className="h-9 rounded-xl border-slate-800 bg-slate-950 text-slate-200 text-xs px-3 font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-400 font-bold">Exenta</Label>
                  <Input value={formExenta} onChange={(e) => setFormExenta(e.target.value)} className="h-9 rounded-xl border-slate-800 bg-slate-950 text-slate-200 text-xs px-3 font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Local / Emisor</Label>
                  <Input value={formCounterparty} onChange={(e) => setFormCounterparty(e.target.value)} className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs px-4" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">N° de Documento (Ej: 001-001...)</Label>
                  <Input placeholder="001-001-0000001" value={formDocNumber} onChange={(e) => setFormDocNumber(e.target.value)} className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs px-4 font-mono" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-bold">Código CDC (Factura Electrónica)</Label>
                <Input placeholder="01003798..." value={formCdc} onChange={(e) => setFormCdc(e.target.value)} className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs px-4 font-mono" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-bold">Detalle / Concepto</Label>
                <Input required value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs px-4" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Fecha de Emisión</Label>
                  <Input type="date" required value={formDate} onChange={(e) => setFormDate(e.target.value)} className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs px-4 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Categoría</Label>
                  <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full h-11 rounded-2xl border border-slate-800 bg-slate-950 px-4 text-xs text-slate-100 outline-none">
                    {CATEGORIES_EXPENSE.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.id}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="rounded-xl border-slate-700 text-xs text-slate-300 h-10 px-4">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white h-10 px-6">
                  {isSubmitting ? "Guardando..." : "Confirmar y Guardar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ZOOM CON DESCARGA PNG DIRECTA */}
      {zoomImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full h-full overflow-auto flex flex-col items-center justify-center p-4">
            <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
              <Button
                onClick={() => downloadImage(zoomImageModal)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg gap-2"
              >
                <Download className="h-4 w-4" /> Descargar PNG
              </Button>
              <Button
                onClick={() => setZoomImageModal(null)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg"
              >
                Cerrar Visor ✕
              </Button>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoomImageModal} alt="Zoom factura" className="max-w-[95vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-slate-700 bg-white my-auto scale-110 origin-center transition-transform" />
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in zoom-in-95">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-100">¿Eliminar registro?</h3>
                <p className="text-xs text-slate-400">Esta acción actualizará tu balance contable.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setItemToDelete(null)} className="rounded-xl border-slate-700 text-xs text-slate-300 h-10 px-4">
                Cancelar
              </Button>
              <Button size="sm" disabled={isDeleting} onClick={confirmDelete} className="rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs text-white h-10 px-5">
                {isDeleting ? "Eliminando..." : "Sí, Eliminar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}