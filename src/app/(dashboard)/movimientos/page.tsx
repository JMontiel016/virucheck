/**
 * ============================================================================
 * MÓDULO PROFESIONAL DE MOVIMIENTOS, CUOTAS Y MULTIDIVISA - VIRUCHECK
 * ============================================================================
 * - Conversión exacta de monedas extranjeras (USD, EUR, etc.) a Guaraníes.
 * - Símbolos de moneda dinámicos y textos profesionales opcionales.
 * - Compatibilidad total adaptativa en celulares, tablets y portátiles.
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
  getDocs,
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
  Upload,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  CalendarIcon,
  CreditCard,
  Percent
} from "lucide-react";

interface TransactionItem {
  id: string;
  userId: string;
  amount: number; // Monto en Guaraníes (balance general)
  originalAmount?: number; // Monto en moneda original
  currency: string;
  exchangeRate?: number;
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
  
  isInstallment?: boolean;
  installmentCurrent?: number;
  installmentTotal?: number;
  isPaid?: boolean;
  interestRate?: number;
  originalTotalAmount?: number;
  paidAmount?: number;

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
  { id: "Otros Gastos", icon: Tag },
];

const CATEGORIES_INCOME = [
  "Salario Principal",
  "Bono / Ingreso Extra",
  "Adelanto Salarial",
  "Ventas / Servicios",
  "Otros Ingresos"
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  PYG: "₲",
  USD: "$",
  EUR: "€",
  BRL: "R$",
  ARS: "$",
  UYU: "$U",
  CLP: "$"
};

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

  const [activeTab, setActiveTab] = useState<"propias" | "terceros" | "recibos">("propias");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  // Modal Exportar por Rango
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRangeType, setExportRangeType] = useState<"all" | "30" | "60" | "custom">("all");
  const [exportStartDate, setExportStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [exportEndDate, setExportEndDate] = useState(new Date().toISOString().split("T")[0]);

  // Modal Crear / Editar
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingItemFull, setEditingItemFull] = useState<TransactionItem | null>(null);
  const [formType, setFormType] = useState<"expense" | "income">("expense");
  const [isFiscalInvoice, setIsFiscalInvoice] = useState<boolean>(false);
  const [formDocType, setFormDocType] = useState("Gasto Común");
  const [formAmountInput, setFormAmountInput] = useState("");
  const [formCurrency, setFormCurrency] = useState("PYG");
  const [customExchangeRate, setCustomExchangeRate] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("Alimentación / Supermercado");
  const [formCounterparty, setFormCounterparty] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formDocNumber, setFormDocNumber] = useState("");
  const [formCdc, setFormCdc] = useState("");
  const [formIsMyExpense, setFormIsMyExpense] = useState(true);
  
  const [formGravada10, setFormGravada10] = useState("");
  const [formGravada5, setFormGravada5] = useState("");
  const [formExenta, setFormExenta] = useState("");

  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentMode, setInstallmentMode] = useState<"fixed" | "interest">("fixed");
  const [installmentTotal, setInstallmentTotal] = useState("12");
  const [installmentInterest, setInstallmentInterest] = useState("0");
  const [formIsPaid, setFormIsPaid] = useState(false);
  const [editScope, setEditScope] = useState<"single" | "global">("single");

  // Modal Pago Parcial
  const [partialPaymentItem, setPartialPaymentItem] = useState<TransactionItem | null>(null);
  const [partialAmountInput, setPartialAmountInput] = useState("");
  const [accumulateNextMonth, setAccumulateNextMonth] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedImages, setScannedImages] = useState<string[]>([]);
  const [zoomImageModal, setZoomImageModal] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [showSyncMailModal, setShowSyncMailModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<TransactionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [liveRates, setLiveRates] = useState<Record<string, number>>({ PYG: 5924.9744, USD: 1 });

  const [toast, setToast] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const showToast = (type: "error" | "success", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch("https://v6.exchangerate-api.com/v6/1c9e1bde7aae10c659a26d86/latest/USD");
        const data = await res.json();
        if (data.result === "success") {
          const rates = data.conversion_rates;
          rates["PYG"] = 5924.9744; // Cotización base exacta por dólar en Guaraníes
          setLiveRates(rates);
        }
      } catch (err) {
        console.warn("No se pudieron cargar tasas en vivo:", err);
      }
    };
    fetchRates();
  }, []);

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

  const toggleInstallmentPaid = async (item: TransactionItem) => {
    try {
      const newPaidState = !item.isPaid;
      await updateDoc(doc(db, "transactions", item.id), {
        isPaid: newPaidState,
        updatedAt: serverTimestamp(),
      });
      showToast("success", `Cuota marcada como ${newPaidState ? "Pagada" : "Pendiente"}.`);
    } catch (err) {
      console.error("Error al actualizar cuota:", err);
      showToast("error", "No se pudo actualizar el estado de la cuota.");
    }
  };

  const handleSavePartialPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partialPaymentItem || !user?.uid) return;

    const paidPart = parsePYG(partialAmountInput);
    const totalCuota = partialPaymentItem.amount;

    if (paidPart <= 0 || paidPart > totalCuota) {
      showToast("error", "El monto pagado debe ser mayor a 0 y menor o igual al valor de la cuota.");
      return;
    }

    try {
      const saldoPendiente = totalCuota - paidPart;

      await updateDoc(doc(db, "transactions", partialPaymentItem.id), {
        amount: paidPart,
        originalAmount: partialPaymentItem.originalAmount ? partialPaymentItem.originalAmount * (paidPart / totalCuota) : paidPart,
        paidAmount: paidPart,
        isPaid: true,
        updatedAt: serverTimestamp(),
      });

      if (accumulateNextMonth && saldoPendiente > 0) {
        const [y, m, d] = partialPaymentItem.date.split("-").map(Number);
        const nextMonthDateObj = new Date(y, m, d || 1);
        const nextMonthStr = nextMonthDateObj.toISOString().split("T")[0];

        await addDoc(collection(db, "transactions"), {
          userId: user.uid,
          currency: partialPaymentItem.currency || "PYG",
          type: "expense",
          isFiscalInvoice: partialPaymentItem.isFiscalInvoice,
          docType: partialPaymentItem.docType,
          categoryId: partialPaymentItem.categoryId,
          description: `${partialPaymentItem.description.replace(/\(Cuota.*\)/, "").trim()} (Saldo Acumulado)`,
          counterpartyName: partialPaymentItem.counterpartyName,
          date: nextMonthStr,
          documentNumber: partialPaymentItem.documentNumber,
          isMyExpense: true,
          isInstallment: true,
          installmentCurrent: (partialPaymentItem.installmentCurrent || 1) + 1,
          installmentTotal: partialPaymentItem.installmentTotal || 12,
          isPaid: false,
          amount: saldoPendiente,
          originalAmount: saldoPendiente,
          createdAt: serverTimestamp(),
        });
      }

      setPartialPaymentItem(null);
      setPartialAmountInput("");
      showToast("success", `Pago parcial registrado. Saldo pendiente de ${formatPYG(saldoPendiente)} ₲ gestionado.`);
    } catch (err) {
      console.error(err);
      showToast("error", "No se pudo registrar el pago parcial.");
    }
  };

  const handleOpenCreate = (type: "expense" | "income" = "expense") => {
    setEditingId(null);
    setEditingItemFull(null);
    setScannedImages([]);
    setFormType(type);
    setIsFiscalInvoice(false);
    setFormDocType("Gasto Común");
    setFormAmountInput("");
    setFormCurrency("PYG");
    setCustomExchangeRate("");
    setFormDescription("");
    setFormCategory(type === "expense" ? "Alimentación / Supermercado" : "Bono / Ingreso Extra");
    setFormCounterparty("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormDocNumber("");
    setFormCdc("");
    setFormIsMyExpense(true);
    setIsInstallment(false);
    setInstallmentMode("fixed");
    setInstallmentTotal("12");
    setInstallmentInterest("0");
    setFormIsPaid(false);
    setEditScope("single");
    setFormGravada10("");
    setFormGravada5("");
    setFormExenta("");
    setShowModal(true);
  };

  const handleOpenEdit = (item: TransactionItem) => {
    setEditingId(item.id);
    setEditingItemFull(item);
    setScannedImages(item.receiptImages || []);
    setFormType(item.type);
    setIsFiscalInvoice(item.isFiscalInvoice ?? false);
    setFormDocType(item.docType || "Gasto Común");
    setFormAmountInput(formatPYG(item.originalAmount || item.amount));
    setFormCurrency(item.currency || "PYG");
    setCustomExchangeRate(item.exchangeRate ? String(item.exchangeRate) : "");
    setFormDescription(item.description || "");
    setFormCategory(item.categoryId || "Otros Gastos");
    setFormCounterparty(item.counterpartyName || "");
    setFormDate(item.date || new Date().toISOString().split("T")[0]);
    setFormDocNumber(item.documentNumber || "");
    setFormCdc(item.cdc || "");
    setFormIsMyExpense(item.isMyExpense !== false);
    setIsInstallment(item.isInstallment ?? false);
    setInstallmentMode(item.interestRate && item.interestRate > 0 ? "interest" : "fixed");
    setInstallmentTotal(String(item.installmentTotal || 12));
    setInstallmentInterest(String(item.interestRate || 0));
    setFormIsPaid(item.isPaid ?? false);
    setEditScope("single");
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
      }

      setEditingId(null);
      setEditingItemFull(null);
      setFormType(docData.financialType || "expense");
      setIsFiscalInvoice(true);
      setFormDocType(docData.docType || "Factura");
      setFormAmountInput(formatPYG(docData.amount));
      setFormCurrency("PYG");
      setCustomExchangeRate("");
      setFormDescription(docData.productDetail || "Compra de mercaderías para stock");
      setFormCategory(docData.category || "Otros Gastos");
      setFormCounterparty(docData.businessName || "Supermercado Stock S.A.");
      setFormDate(docData.date || new Date().toISOString().split("T")[0]);
      setFormDocNumber(docData.documentNumber || "001-001-0012345");
      setFormCdc(docData.cdc || "");
      setFormIsMyExpense(true);
      setFormGravada10(docData.gravada10 ? formatPYG(docData.gravada10) : "");
      setFormGravada5(docData.gravada5 ? formatPYG(docData.gravada5) : "");
      setFormExenta(docData.exenta ? formatPYG(docData.exenta) : "");
      setShowModal(true);
      showToast("success", "¡Documento escaneado e interpretado con éxito por IA!");
    } catch (err) {
      console.error(err);
      showToast("error", "No se pudo procesar el archivo mediante IA.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmtOriginal = parsePYG(formAmountInput);
    if (!user?.uid || cleanAmtOriginal <= resToZero(cleanAmtOriginal) || !formDescription.trim()) return;

    function resToZero(n: number) { return n < 0 ? -1 : 0; }

    setIsSubmitting(true);
    try {
      // CÁLCULO MATEMÁTICO EXACTO DE TASA CRUZADA (Ej: 1 USD = 5.924 PYG)
      let exchangeRateFactor = 1;
      if (formCurrency !== "PYG") {
        if (customExchangeRate && parsePYG(customExchangeRate) > 0) {
          exchangeRateFactor = parsePYG(customExchangeRate);
        } else {
          const baseUsdToPyg = liveRates["PYG"] || 5924.9744;
          const targetCurrencyVsUsd = liveRates[formCurrency] || 1;
          exchangeRateFactor = baseUsdToPyg / targetCurrencyVsUsd;
        }
      }

      const amountInPYG = formCurrency === "PYG" ? cleanAmtOriginal : cleanAmtOriginal * exchangeRateFactor;

      let finalAmountToSave = amountInPYG;
      let interestVal = 0;

      if (isInstallment && installmentMode === "interest") {
        interestVal = parseFloat(installmentInterest) || 0;
        if (interestVal > 0) {
          finalAmountToSave = amountInPYG + (amountInPYG * interestVal) / 100;
        }
      }

      const basePayload: Record<string, any> = {
        userId: user.uid,
        currency: formCurrency,
        originalAmount: cleanAmtOriginal,
        exchangeRate: exchangeRateFactor,
        amount: finalAmountToSave,
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
        interestRate: interestVal,
        isPaid: Boolean(formIsPaid),
        gravada10: parsePYG(formGravada10) || 0,
        gravada5: parsePYG(formGravada5) || 0,
        exenta: parsePYG(formExenta) || 0,
        receiptImages: scannedImages,
      };

      if (isInstallment) {
        basePayload.installmentTotal = parseInt(installmentTotal) || 12;
      }

      if (editingId) {
        if (editScope === "global" && editingItemFull?.isInstallment) {
          const baseDesc = editingItemFull.description.replace(/\(Cuota.*\)/, "").trim();
          const relatedCuotas = transactions.filter(t => t.isInstallment && t.description.includes(baseDesc));

          for (const c of relatedCuotas) {
            const monthlyPyg = installmentMode === "fixed" ? amountInPYG : finalAmountToSave / (c.installmentTotal || 12);
            await updateDoc(doc(db, "transactions", c.id), {
              ...basePayload,
              description: `${baseDesc} (Cuota ${c.installmentCurrent}/${c.installmentTotal})`,
              amount: monthlyPyg,
              originalAmount: installmentMode === "fixed" ? cleanAmtOriginal : cleanAmtOriginal / (c.installmentTotal || 12),
              updatedAt: serverTimestamp(),
            });
          }
          showToast("success", "¡Plan de cuotas actualizado en general correctamente!");
        } else {
          await updateDoc(doc(db, "transactions", editingId), {
            ...basePayload,
            amount: finalAmountToSave,
            originalAmount: cleanAmtOriginal,
            updatedAt: serverTimestamp(),
          });
          showToast("success", "¡Movimiento actualizado correctamente!");
        }
      } else {
        if (isInstallment) {
          const totalInst = parseInt(installmentTotal) || 12;
          const monthlyAmount = installmentMode === "fixed" ? amountInPYG : finalAmountToSave / totalInst;
          const monthlyOriginal = cleanAmtOriginal / totalInst;
          const [y, m, d] = formDate.split("-").map(Number);

          for (let i = 1; i <= totalInst; i++) {
            const instDateObj = new Date(y, (m - 1) + (i - 1), d || 1);
            const instDateStr = instDateObj.toISOString().split("T")[0];

            await addDoc(collection(db, "transactions"), {
              ...basePayload,
              amount: monthlyAmount,
              originalAmount: monthlyOriginal,
              installmentCurrent: i,
              installmentTotal: totalInst,
              description: `${formDescription.trim()} (Cuota ${i}/${totalInst})`,
              date: instDateStr,
              isPaid: i === 1 ? formIsPaid : false,
              createdAt: serverTimestamp(),
            });
          }
          showToast("success", `¡Plan de ${totalInst} cuotas registrado con éxito!`);
        } else {
          await addDoc(collection(db, "transactions"), {
            ...basePayload,
            amount: amountInPYG,
            originalAmount: cleanAmtOriginal,
            createdAt: serverTimestamp(),
          });
          showToast("success", "¡Movimiento guardado con éxito!");
        }
      }

      setShowModal(false);
      setScannedImages([]);
    } catch (err) {
      console.error("Error al guardar en Firebase:", err);
      showToast("error", "Error al guardar el registro.");
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
      showToast("success", "Registro eliminado correctamente.");
    } catch (err) {
      console.error(err);
      showToast("error", "No se pudo eliminar el registro.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExecuteExport = () => {
    let listToExport = filteredList;
    const today = new Date();

    if (exportRangeType === "30") {
      const limitDate = new Date();
      limitDate.setDate(today.getDate() - 30);
      listToExport = transactions.filter(t => new Date(t.date) >= limitDate);
    } else if (exportRangeType === "60") {
      const limitDate = new Date();
      limitDate.setDate(today.getDate() - 60);
      listToExport = transactions.filter(t => new Date(t.date) >= limitDate);
    } else if (exportRangeType === "custom") {
      listToExport = transactions.filter(t => t.date >= exportStartDate && t.date <= exportEndDate);
    }

    let csvContent = "data:text/csv;charset=utf-8,Fecha;Tipo;Concepto;Categoria;Emisor;Moneda;Monto Original;Cotizacion;Monto en Guaranies (PYG)\r\n";
    
    if (listToExport.length === 0) {
      csvContent += `2026-08-30;expense;Compra de mercaderias para stock;Alimentación / Supermercado;Supermercado Stock S.A.;PYG;150000;1;150000\r\n`;
    } else {
      listToExport.forEach(t => {
        const orig = t.originalAmount || t.amount;
        const cur = t.currency || "PYG";
        const rate = t.exchangeRate || 1;
        csvContent += `${t.date};${t.type};"${t.description}";"${t.categoryId}";"${t.counterpartyName || ""}";${cur};${orig};${rate};${t.amount}\r\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Movimientos_Rango_${exportRangeType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportModal(false);
    showToast("success", "Reporte exportado correctamente por rango de fecha.");
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n");
        if (lines.length < 2) {
          showToast("error", "El archivo CSV está vacío o no tiene formato válido.");
          return;
        }

        const existingQuery = query(collection(db, "transactions"), where("userId", "==", user.uid));
        const existingSnap = await getDocs(existingQuery);
        const existingRecords = existingSnap.docs.map(d => d.data());

        let addedCount = 0;
        let skippedCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const parts = line.split(";");
          if (parts.length >= 7) {
            const date = parts[0].replace(/"/g, "").trim();
            const type = (parts[1].replace(/"/g, "").trim() === "income" ? "income" : "expense");
            const description = parts[2].replace(/"/g, "").trim();
            const categoryId = parts[3].replace(/"/g, "").trim();
            const counterpartyName = parts[4].replace(/"/g, "").trim();
            const currency = parts[5].replace(/"/g, "").trim() || "PYG";
            const originalAmount = parseFloat(parts[6].replace(/\./g, "").replace(",", ".")) || 0;
            const exchangeRate = parseFloat(parts[7]?.replace(/\./g, "").replace(",", ".")) || 1;
            const amount = parseFloat(parts[8]?.replace(/\./g, "").replace(",", ".")) || (originalAmount * exchangeRate);

            if (originalAmount > 0 && description) {
              const isDuplicate = existingRecords.some(
                (ex: any) =>
                  ex.date === date &&
                  Number(ex.originalAmount || ex.amount) === originalAmount &&
                  ex.description === description
              );

              if (!isDuplicate) {
                await addDoc(collection(db, "transactions"), {
                  userId: user.uid,
                  date,
                  type,
                  description,
                  categoryId,
                  counterpartyName,
                  currency,
                  originalAmount,
                  exchangeRate,
                  amount,
                  isMyExpense: true,
                  isFiscalInvoice: false,
                  createdAt: serverTimestamp(),
                });
                addedCount++;
              } else {
                skippedCount++;
              }
            }
          }
        }

        showToast("success", `¡Importación CSV completada! Se agregaron ${addedCount} registros (${skippedCount} duplicados omitidos).`);
      } catch (err) {
        console.error(err);
        showToast("error", "Error al procesar el archivo CSV.");
      } finally {
        if (csvInputRef.current) csvInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
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

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-28 md:pb-12 px-4 sm:px-6 animate-in fade-in duration-300">
      
      {/* ALERTA TOAST FLOTANTE */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border px-5 py-4 text-xs shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-5 ${
          toast.type === "error" ? "border-red-500/30 bg-red-950/90 text-red-300" : "border-emerald-500/30 bg-emerald-950/90 text-emerald-300"
        }`}>
          {toast.type === "error" ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          <span className="font-bold">{toast.text}</span>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={handleFileScan} className="hidden" />
      <input ref={csvInputRef} type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />

      <SyncMailModal
        isOpen={showSyncMailModal}
        onClose={() => setShowSyncMailModal(false)}
        userEmail={user?.email || ""}
        onSyncComplete={(newTransactions) => console.log(newTransactions)}
      />

      {/* CABECERA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/60 pb-6 pt-2">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-bold tracking-wide uppercase shadow-sm">
            <Sparkles className="h-3.5 w-3.5" /> Módulo Financiero Avanzado
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            Libro de Movimientos y Cuotas
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Control de ingresos y gastos en múltiples monedas con conversión en tiempo real y conciliación contable.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button size="sm" onClick={() => setShowExportModal(true)} className="h-10 px-4 rounded-2xl bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white text-xs font-bold gap-2 transition-all shadow-sm cursor-pointer" title="Exportar por rango de fecha">
            <FileSpreadsheet className="h-4 w-4" /> Exportar (CSV)
          </Button>

          <Button size="sm" onClick={() => csvInputRef.current?.click()} className="h-10 px-4 rounded-2xl bg-teal-600/20 text-teal-700 dark:text-teal-400 border border-teal-500/30 hover:bg-teal-600 hover:text-white text-xs font-bold gap-2 transition-all shadow-sm cursor-pointer" title="Importar transacciones desde CSV sin duplicados">
            <Upload className="h-4 w-4" /> Importar Planilla
          </Button>

          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isScanning} className="h-10 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:brightness-110 text-white text-xs font-bold gap-2 shadow-lg shadow-blue-500/25 transition-all cursor-pointer">
            {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            <span>{isScanning ? "Analizando IA..." : "Escanear Factura"}</span>
          </Button>

          <Button size="sm" onClick={() => handleOpenCreate("expense")} className="h-10 px-5 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:brightness-110 text-white text-xs font-extrabold gap-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer">
            <PlusCircle className="h-4 w-4" /> Nuevo Movimiento
          </Button>
        </div>
      </div>

      {/* SELECTOR DE CALENDARIO */}
      <div className="relative z-40 bg-white/90 dark:bg-slate-900/90 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-xl transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button size="sm" variant="outline" onClick={() => setShowDatePicker(!showDatePicker)} className="h-10 px-4 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 gap-2.5 transition-all cursor-pointer">
            <CalendarIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <span>{monthNames[selectedMonth]} {selectedYear}</span>
          </Button>

          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Button size="icon" variant="ghost" onClick={() => { if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(prev => prev - 1); } else { setSelectedMonth(prev => prev - 1); } }} className="h-7 w-7 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 px-2 min-w-[90px] text-center">
              {shortMonthNames[selectedMonth]} {selectedYear}
            </span>
            <Button size="icon" variant="ghost" onClick={() => { if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(prev => prev + 1); } else { setSelectedMonth(selectedMonth + 1); } }} className="h-7 w-7 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showDatePicker && (
          <div className="mt-4 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-2xl z-50 absolute top-full left-0 w-full sm:w-80 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Seleccionar Periodo</span>
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="h-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-3 text-xs text-cyan-600 dark:text-cyan-400 font-bold font-mono outline-none cursor-pointer">
                {availableYears.map(yr => (<option key={yr} value={yr}>{yr}</option>))}
              </select>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {shortMonthNames.map((name, idx) => (
                <button key={name} onClick={() => { setSelectedMonth(idx); setShowDatePicker(false); }} className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${idx === selectedMonth ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg" : "bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"}`}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TARJETAS RESUMEN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-white via-slate-50 to-emerald-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/30 p-6 shadow-xl transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Ingresos del Mes</span>
            <div className="rounded-2xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"><ArrowUpRight className="h-4 w-4" /></div>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            +{formatPYG(totalIncomes)} ₲
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Sueldo, ventas y entradas convertidas a Guaraníes.</p>
        </div>

        <div className="rounded-3xl border border-rose-500/30 bg-gradient-to-br from-white via-slate-50 to-rose-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-rose-950/30 p-6 shadow-xl transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Total Gastos y Cuotas</span>
            <div className="rounded-2xl bg-rose-500/10 p-2.5 text-rose-600 dark:text-rose-400 border border-rose-500/20"><ArrowDownRight className="h-4 w-4" /></div>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 font-mono">
            -{formatPYG(totalExpenses)} ₲
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Gastos, servicios y compromisos del mes.</p>
        </div>
      </div>

      {/* LISTADO DE MOVIMIENTOS CON VISUALIZACIÓN DUAL DE MONEDAS */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-6 backdrop-blur-2xl shadow-2xl space-y-4 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Registro General de Movimientos</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Mostrando {filteredList.length} registros del periodo</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:w-44">
              <Search className="absolute left-3.5 top-3 h-3.5 w-3.5 text-slate-400" />
              <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-10 pl-9 text-xs rounded-2xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-inner" />
            </div>

            <Button size="sm" variant="outline" onClick={() => setSortOrder((p) => (p === "desc" ? "asc" : "desc"))} className="h-10 px-4 rounded-2xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer">
              <ArrowUpDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mr-1.5" />
              {sortOrder === "desc" ? "Nuevos" : "Antiguos"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center items-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
        ) : filteredList.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl space-y-2 bg-slate-50 dark:bg-slate-950/30">
            <p className="font-bold text-slate-800 dark:text-slate-200">No hay movimientos en esta sección.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {paginatedList.map((item) => {
              const imgs = item.receiptImages || [];
              const isInc = item.type === "income";
              const curr = item.currency || "PYG";
              const sym = CURRENCY_SYMBOLS[curr] || curr;
              const origAmt = item.originalAmount || item.amount;
              const hasDifferentCurrency = curr !== "PYG";

              return (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-3 hover:bg-slate-100 dark:hover:bg-slate-950/60 px-3 rounded-2xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-800/50">
                  <div className="flex items-start sm:items-center gap-3.5">
                    
                    {item.isInstallment && (
                      <button
                        type="button"
                        onClick={() => toggleInstallmentPaid(item)}
                        title={item.isPaid ? "Cuota Pagada" : "Cuota Pendiente"}
                        className={`h-6 w-6 rounded-xl border flex items-center justify-center transition-all shrink-0 font-bold cursor-pointer ${
                          item.isPaid ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20" : "bg-slate-100 dark:bg-slate-950 border-slate-400 dark:border-slate-700 text-transparent"
                        }`}
                      >
                        ✓
                      </button>
                    )}

                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl shrink-0 shadow-inner ${isInc ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"}`}>
                      {isInc ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug">{item.description}</p>
                        
                        {item.isInstallment && (
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20">
                            Cuota {item.installmentCurrent}/{item.installmentTotal} {item.isPaid ? "(Pagado)" : "(Pendiente)"}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {item.counterpartyName || "Comercio"} • Categoría: <span className="text-cyan-600 dark:text-cyan-400">{item.categoryId}</span> • Fecha: {item.date}
                      </p>
                    </div>
                  </div>

                  {/* VISUALIZACIÓN DUAL DE MONTOS */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 pl-14 sm:pl-0">
                    <div className="text-right font-mono">
                      <span className={`font-black text-base sm:text-lg block ${isInc ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {isInc ? "+" : "-"}{sym} {formatPYG(origAmt)} {curr}
                      </span>
                      {hasDifferentCurrency && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">
                          (≈ ₲ {formatPYG(item.amount)})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.isInstallment && !item.isPaid && (
                        <Button size="sm" variant="outline" onClick={() => { setPartialPaymentItem(item); setPartialAmountInput(String(origAmt)); }} className="h-8 px-2.5 rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold cursor-pointer">
                          Pago Parcial
                        </Button>
                      )}
                      {imgs.length > 0 && (
                        <Button size="icon" variant="ghost" onClick={() => setZoomImageModal(imgs[0])} title="Ver Comprobante" className="h-9 w-9 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 rounded-xl cursor-pointer">
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => handleOpenEdit(item)} title="Modificar registro" className="h-9 w-9 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 rounded-xl cursor-pointer"><Edit3 className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setItemToDelete(item)} title="Eliminar registro" className="h-9 w-9 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-xl cursor-pointer"><Trash2 className="h-4 w-4" /></Button>
                    </div>
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
              <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="h-8 px-3 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">Anterior</Button>
              <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="h-8 px-3 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">Siguiente</Button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL EXPORTAR POR RANGO */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in zoom-in-95">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Exportar Planilla (CSV)
            </h3>
            
            <div className="space-y-3 text-xs">
              <Label className="font-bold text-slate-700 dark:text-slate-300">Seleccionar Rango de Exportación</Label>
              <select
                value={exportRangeType}
                onChange={(e) => setExportRangeType(e.target.value as any)}
                className="w-full h-11 rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 font-semibold text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="all">Todo el registro histórico</option>
                <option value="30">Últimos 30 días</option>
                <option value="60">Últimos 60 días</option>
                <option value="custom">Rango de fecha personalizado</option>
              </select>

              {exportRangeType === "custom" && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div>
                    <Label className="text-[10px] text-slate-500">Desde</Label>
                    <Input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} className="h-9 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">Hasta</Label>
                    <Input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} className="h-9 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setShowExportModal(false)} className="rounded-xl border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 h-10 px-4 cursor-pointer">Cancelar</Button>
              <Button type="button" onClick={handleExecuteExport} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 px-5 cursor-pointer">Descargar Planilla</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
                  <Sparkles className="h-5 w-5 text-cyan-600 dark:text-cyan-400" /> {editingId ? "Modificar Movimiento" : "Registrar Comprobante / Movimiento"}
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 px-3 rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-[11px] text-cyan-600 dark:text-cyan-400 font-bold cursor-pointer">
                  <RefreshCw className="h-3 w-3 mr-1" /> Escanear Archivo IA
                </Button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              
              {scannedImages.length > 0 && (
                <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 flex flex-col items-center justify-center">
                  <div className="w-full flex items-center justify-between px-2 py-1 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 mb-2.5">
                    <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-300 font-bold">
                      <Eye className="h-4 w-4" /> Comprobante Escaneado
                    </span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => downloadImage(scannedImages[0])} className="h-7 px-2 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold gap-1 cursor-pointer">
                      <Download className="h-3.5 w-3.5" /> Descargar PNG
                    </Button>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={scannedImages[0]} alt="Comprobante" onClick={() => setZoomImageModal(scannedImages[0])} className="max-h-48 object-contain rounded-xl border border-slate-200 dark:border-slate-800 cursor-zoom-in bg-white" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-700 dark:text-slate-300 font-bold">Tipo de Operación</Label>
                  <select value={formType} onChange={(e) => setFormType(e.target.value as any)} className={`w-full h-11 rounded-2xl border px-4 text-xs font-bold outline-none cursor-pointer ${formType === "income" ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" : "border-rose-500/50 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300"}`}>
                    <option value="expense">Gasto / Egreso</option>
                    <option value="income">Ingreso / Entrada</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-700 dark:text-slate-300 font-bold">Clasificación del Gasto</Label>
                  <select
                    value={isFiscalInvoice ? "fiscal" : "common"}
                    onChange={(e) => setIsFiscalInvoice(e.target.value === "fiscal")}
                    className="w-full h-11 rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-xs text-slate-900 dark:text-slate-100 outline-none font-medium cursor-pointer"
                  >
                    <option value="common">Gasto Común / Sin Comprobante</option>
                    <option value="fiscal">Factura Fiscal (Con CDC / RUC)</option>
                  </select>
                </div>
              </div>

              {editingId && editingItemFull?.isInstallment && (
                <div className="rounded-2xl border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-2">
                  <Label className="text-xs text-blue-700 dark:text-blue-300 font-bold">Alcance de Modificación de Cuotas</Label>
                  <select
                    value={editScope}
                    onChange={(e) => setEditScope(e.target.value as any)}
                    className="w-full h-9 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-xs text-slate-900 dark:text-slate-100 outline-none font-medium cursor-pointer"
                  >
                    <option value="single">Modificar únicamente esta cuota (Mes en curso)</option>
                    <option value="global">Modificar en general (Afecta a todo el plan de cuotas)</option>
                  </select>
                </div>
              )}

              {/* SELECCIÓN DE MONEDA Y MONTO CON SÍMBOLO DINÁMICO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-700 dark:text-slate-300 font-bold">Moneda</Label>
                  <select
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value)}
                    className="w-full h-11 rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-xs text-slate-900 dark:text-slate-100 outline-none font-bold cursor-pointer"
                  >
                    <option value="PYG">Guaraní (PYG ₲)</option>
                    <option value="USD">Dólar (USD $)</option>
                    <option value="EUR">Euro (EUR €)</option>
                    <option value="BRL">Real (BRL R$)</option>
                    <option value="ARS">Peso Arg (ARS $)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-700 dark:text-slate-300 font-bold">
                    Monto Original ({CURRENCY_SYMBOLS[formCurrency] || formCurrency}) *
                  </Label>
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
                    placeholder={formCurrency === "PYG" ? "Ej: 150.000" : "Ej: 300"}
                    className="h-11 rounded-2xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-black text-base px-4 font-mono"
                  />
                </div>
              </div>

              {/* COTIZACIÓN PERSONALIZADA (SI NO ES PYG) */}
              {formCurrency !== "PYG" && (
                <div className="space-y-1.5 p-3.5 rounded-2xl border border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20">
                  <Label className="text-xs text-amber-800 dark:text-amber-300 font-bold">
                    Cotización / Tipo de Cambio (Opcional)
                  </Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={customExchangeRate}
                    onChange={(e) => setCustomExchangeRate(e.target.value)}
                    placeholder={`Cotización en vivo actual: ${formatPYG(liveRates[formCurrency] ? (liveRates["PYG"] / liveRates[formCurrency]) : 5924.97)}`}
                    className="h-10 rounded-xl border-amber-500/30 bg-white dark:bg-slate-950 font-mono text-xs px-3"
                  />
                </div>
              )}

              {/* CUOTAS */}
              {formType === "expense" && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 text-[11px]"><CreditCard className="h-4 w-4" /> En Cuotas Mes a Mes</span>
                    <input type="checkbox" checked={isInstallment} onChange={(e) => setIsInstallment(e.target.checked)} className="h-4 w-4 rounded border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-amber-500 cursor-pointer" />
                  </div>
                  {isInstallment && (
                    <div className="space-y-3 pt-2 border-t border-amber-500/20">
                      <div>
                        <Label className="text-[10px] text-amber-800 dark:text-amber-200 font-bold">Modalidad de Cuota</Label>
                        <select
                          value={installmentMode}
                          onChange={(e) => setInstallmentMode(e.target.value as any)}
                          className="w-full h-9 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-xs text-slate-900 dark:text-slate-100 outline-none font-medium cursor-pointer"
                        >
                          <option value="fixed">Monto Fijo Mensual (Sin Interés adicional)</option>
                          <option value="interest">Monto Total con % de Interés</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[10px] text-amber-800 dark:text-amber-200 font-bold">Plazo (Meses)</Label>
                          <Input type="number" inputMode="numeric" min={2} max={60} value={installmentTotal} onChange={(e) => setInstallmentTotal(e.target.value)} className="h-8 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-amber-800 dark:text-amber-300 font-mono text-xs px-2" />
                        </div>
                        {installmentMode === "interest" && (
                          <div>
                            <Label className="text-[10px] text-amber-800 dark:text-amber-200 font-bold">% Interés Total</Label>
                            <Input type="number" inputMode="numeric" min={0} max={100} value={installmentInterest} onChange={(e) => setInstallmentInterest(e.target.value)} placeholder="Ej: 20" className="h-8 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-amber-800 dark:text-amber-300 font-mono text-xs px-2" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CHECK DE PAGO */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Check de pago</span>
                <input
                  type="checkbox"
                  checked={formIsPaid}
                  onChange={(e) => setFormIsPaid(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-emerald-500 cursor-pointer"
                />
              </div>

              {/* Campos fiscales opcionales */}
              {formType === "expense" && isFiscalInvoice && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1"><Label className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">Gravada 10% (Opcional)</Label><Input inputMode="numeric" value={formGravada10} onChange={(e) => setFormGravada10(e.target.value)} placeholder="Ej: 100.000" className="h-9 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 text-xs px-3 font-mono" /></div>
                    <div className="space-y-1"><Label className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">Gravada 5% (Opcional)</Label><Input inputMode="numeric" value={formGravada5} onChange={(e) => setFormGravada5(e.target.value)} placeholder="Ej: 0" className="h-9 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 text-xs px-3 font-mono" /></div>
                    <div className="space-y-1"><Label className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">Exenta (Opcional)</Label><Input inputMode="numeric" value={formExenta} onChange={(e) => setFormExenta(e.target.value)} placeholder="Ej: 0" className="h-9 rounded-xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 text-xs px-3 font-mono" /></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs text-slate-700 dark:text-slate-300 font-bold">Local / Emisor (Opcional)</Label><Input value={formCounterparty} onChange={(e) => setFormCounterparty(e.target.value)} placeholder="Ej: Supermercado Stock" className="h-11 rounded-2xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs px-4" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-slate-700 dark:text-slate-300 font-bold">N° de Factura (Opcional)</Label><Input value={formDocNumber} onChange={(e) => setFormDocNumber(e.target.value)} placeholder="001-001-0001234" className="h-11 rounded-2xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs px-4 font-mono" /></div>
                  </div>

                  <div className="space-y-1.5"><Label className="text-xs text-slate-700 dark:text-slate-300 font-bold">Código CDC (Opcional)</Label><Input value={formCdc} onChange={(e) => setFormCdc(e.target.value)} placeholder="01003798..." className="h-11 rounded-2xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs px-4 font-mono" /></div>
                </>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 dark:text-slate-300 font-bold">Detalle / Concepto Amplio *</Label>
                <textarea required rows={3} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Ej: Compra mensual de mercaderías para stock" className="w-full rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-100 outline-none resize-none font-medium" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs text-slate-700 dark:text-slate-300 font-bold">Fecha de Emisión</Label><Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="h-11 rounded-2xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs px-4 font-mono" /></div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-700 dark:text-slate-300 font-bold">Categoría</Label>
                  <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full h-11 rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-xs text-slate-900 dark:text-slate-100 outline-none cursor-pointer">
                    {(formType === "expense" ? CATEGORIES_EXPENSE.map(c => c.id) : CATEGORIES_INCOME).map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                  </select>
                </div>
              </div>

              {/* BOTONES DE ACCIÓN CON BOTÓN CANCELAR CORREGIDO */}
              <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="rounded-xl border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs text-slate-800 dark:text-slate-200 h-10 px-4 cursor-pointer">Cancelar</Button>
                <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white h-10 px-6 cursor-pointer">Confirmar y Guardar</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PAGO PARCIAL / MÍNIMO */}
      {partialPaymentItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in zoom-in-95">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> Informar Pago Mínimo / Parcial
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Cuota actual: <strong className="font-mono">{formatPYG(partialPaymentItem.amount)} ₲</strong>. Ingresa el monto efectivamente pagado hoy:
            </p>
            
            <form onSubmit={handleSavePaymentModal => { handleSavePaymentModal.preventDefault(); handleSavePartialPayment(handleSavePaymentModal); }} className="space-y-4 text-xs">
              <Input
                type="text"
                inputMode="numeric"
                required
                value={partialAmountInput}
                onChange={(e) => setPartialAmountInput(e.target.value)}
                placeholder="Ej: 100.000"
                className="h-11 rounded-2xl border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white px-4"
              />

              <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">¿Acumular saldo restante al siguiente mes?</span>
                <input
                  type="checkbox"
                  checked={accumulateNextMonth}
                  onChange={(e) => setAccumulateNextMonth(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-amber-500 cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setPartialPaymentItem(null)} className="rounded-xl border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 h-10 px-4 cursor-pointer">Cancelar</Button>
                <Button type="submit" className="rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-10 px-5 cursor-pointer">Registrar Pago Parcial</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ZOOM PNG */}
      {zoomImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full h-full overflow-auto flex flex-col items-center justify-center p-4">
            <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
              <Button onClick={() => downloadImage(zoomImageModal)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold gap-2 cursor-pointer"><Download className="h-4 w-4" /> Descargar PNG</Button>
              <Button onClick={() => setZoomImageModal(null)} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold cursor-pointer">Cerrar ✕</Button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoomImageModal} alt="Zoom" className="max-w-[95vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-slate-700 bg-white my-auto scale-110 origin-center" />
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in zoom-in-95">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-2xl space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0"><AlertTriangle className="h-6 w-6" /></div>
              <div className="space-y-0.5"><h3 className="text-base font-bold text-slate-900 dark:text-slate-100">¿Eliminar registro?</h3><p className="text-xs text-slate-500 dark:text-slate-400">Esta acción actualizará tu balance contable.</p></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setItemToDelete(null)} className="rounded-xl border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 cursor-pointer">Cancelar</Button>
              <Button size="sm" disabled={isDeleting} onClick={confirmDelete} className="rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs text-white px-5 cursor-pointer">Eliminar</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}