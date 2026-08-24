export interface CategoryItem {
  id: string;
  name: string;
  type: "expense" | "income";
  icon?: string;
}

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  // Gastos
  { id: "alimentacion", name: "Alimentación y Supermercado", type: "expense" },
  { id: "vivienda", name: "Vivienda, Alquiler y Servicios", type: "expense" },
  { id: "transporte", name: "Transporte y Combustible", type: "expense" },
  { id: "salud", name: "Salud y Farmacia", type: "expense" },
  { id: "educacion", name: "Educación y Capacitación", type: "expense" },
  { id: "entretenimiento", name: "Ocio y Entretenimiento", type: "expense" },
  { id: "cuotas", name: "Cuotas y Tarjetas", type: "expense" },
  { id: "general", name: "Gastos Varios / General", type: "expense" },

  // Ingresos
  { id: "salario", name: "Salario / Sueldo Fijo", type: "income" },
  { id: "honorarios", name: "Honorarios Profesionales", type: "income" },
  { id: "ventas", name: "Ventas de Negocio", type: "income" },
  { id: "inversiones", name: "Rendimientos e Inversiones", type: "income" },
  { id: "otros_ingresos", name: "Otros Ingresos", type: "income" },
];

export function getCategoryName(categoryId: string): string {
  const cat = DEFAULT_CATEGORIES.find((c) => c.id === categoryId);
  return cat ? cat.name : categoryId;
}