import { Currency } from "@/types";

/**
 * Formatea un número a formato monetario (PYG sin decimales con puntos, USD con decimales)
 */
export function formatCurrency(amount: number, currency: Currency = "PYG"): string {
  if (currency === "PYG") {
    return `Gs. ${Math.round(amount).toLocaleString("es-PY")}`;
  }
  return `$ ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const UNIDADES = ["", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const DECENAS = [
  "",
  "diez",
  "veinte",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
];
const DIEZ_A_DIECINUEVE = [
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
];
const VEINTIUNO_A_VEINTINUEVE = [
  "veinte",
  "veintiún",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve",
];
const CENTENAS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];

function convertirSeccion(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";

  let out = "";
  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;

  if (c > 0) out += CENTENAS[c] + " ";

  const du = n % 100;
  if (du >= 10 && du <= 19) {
    out += DIEZ_A_DIECINUEVE[du - 10] + " ";
  } else if (du >= 20 && du <= 29) {
    out += VEINTIUNO_A_VEINTINUEVE[du - 20] + " ";
  } else {
    if (d > 0) {
      out += DECENAS[d];
      if (u > 0) out += " y ";
      else out += " ";
    }
    if (u > 0) out += UNIDADES[u] + " ";
  }

  return out.trim();
}

/**
 * Convierte un importe numérico a palabras formales para el recibo de respaldo civil (RF16)
 */
export function numberToWords(amount: number, currency: Currency = "PYG"): string {
  const integerPart = Math.floor(Math.abs(amount));
  if (integerPart === 0) {
    return currency === "PYG" ? "Cero guaraníes exactos" : "Cero dólares";
  }

  const millones = Math.floor(integerPart / 1000000);
  const miles = Math.floor((integerPart % 1000000) / 1000);
  const unidades = integerPart % 1000;

  let resultado = "";

  if (millones > 0) {
    if (millones === 1) {
      resultado += "un millón ";
    } else {
      resultado += `${convertirSeccion(millones)} millones `;
    }
  }

  if (miles > 0) {
    if (miles === 1) {
      resultado += "mil ";
    } else {
      resultado += `${convertirSeccion(miles)} mil `;
    }
  }

  if (unidades > 0) {
    resultado += `${convertirSeccion(unidades)} `;
  }

  resultado = resultado.trim();
  resultado = resultado.charAt(0).toUpperCase() + resultado.slice(1);

  if (currency === "PYG") {
    return `${resultado} guaraníes exactos.`;
  } else {
    const decimals = Math.round((Math.abs(amount) - integerPart) * 100);
    return `${resultado} dólares con ${decimals.toString().padStart(2, "0")}/100 USD.`;
  }
}