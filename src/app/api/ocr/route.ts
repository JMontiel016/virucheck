import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se subió ningún archivo" }, { status: 400 });
    }

    const pythonFormData = new FormData();
    pythonFormData.append("file", file);

    const response = await fetch("http://127.0.0.1:8005/process", {
      method: "POST",
      body: pythonFormData,
    });

    if (!response.ok) {
      throw new Error(`Error en el servicio Python: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error OCR Proxy:", error?.message || error);
    return NextResponse.json(
      {
        docType: "Factura",
        financialType: "expense",
        amount: 0,
        businessName: "Comercio",
        productDetail: "Comprobante Escaneado",
        category: "Otros Gastos",
        date: new Date().toISOString().split("T")[0],
      },
      { status: 200 }
    );
  }
}