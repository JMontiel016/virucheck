export type WorkerType = "dependent" | "independent";

export interface IncomeProfile {
  id?: string;
  userId: string;
  workerType: WorkerType; // 'dependent' (Asalariado) o 'independent' (Prestador de servicios)
  grossAmount: number; // Monto Bruto mensual (o promedio en independientes)
  hasIps: boolean; // Si aplica IPS (9% obrero)
  ipsRate: number; // 0.09 por defecto si hasIps === true
  ipsDeduction: number; // Monto descontado de IPS
  appliesIva: boolean; // Para prestadores de servicios (ej. IVA 10% incluido o discriminado)
  ivaAmount: number;
  netLiquidity: number; // Monto Neto Real que ingresa al bolsillo
  payDay: number; // Día de cobro (1 al 31)
  currency: "PYG" | "USD";
  updatedAt: any;
}

export interface AdditionalIncome {
  id?: string;
  userId: string;
  title: string; // Ej: "Bono por desempeño", "Proyecto Freelance X"
  category: "freelance" | "bonus" | "overtime" | "aguinaldo" | "other";
  amount: number;
  date: string; // YYYY-MM-DD
  notes?: string;
  createdAt: any;
}