"""
Servicio backend de Sincronización y Procesamiento de Facturas (FastAPI)
Optimizado para lectura nativa en PDF y filtrado estricto por fechas en Gmail.
"""

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import pdfplumber
import io
import re
import imaplib
import email
from datetime import datetime, timedelta

app = FastAPI(title="ViruCheck API", version="3.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class SyncMailRequest(BaseModel):
    email: str
    password: str
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    days: int = 30

MONTHS_EN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

def to_imap_date(dt: datetime) -> str:
    return f"{dt.day:02d}-{MONTHS_EN[dt.month - 1]}-{dt.year}"

def parse_extracted_text(raw_text: str):
    lower = raw_text.lower()
    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]

    doc_type = "Factura"
    if any(k in lower for k in ["nota de credito", "nota de crédito", "nc nro"]):
        doc_type = "Nota de Crédito"
    elif any(k in lower for k in ["nota de remision", "remisión", "nota de remisión"]):
        doc_type = "Nota de Remisión"
    elif any(k in lower for k in ["recibo", "recibí de", "recibi de", "transferencia"]):
        doc_type = "Recibo"
    elif any(k in lower for k in ["ticket", "no valido como factura", "resumen de compra"]):
        doc_type = "Ticket"

    doc_number = "S/N"
    nro_match = re.search(r"\b([0-9]{3}-[0-9]{3}-[0-9]{7})\b", raw_text)
    if nro_match:
        doc_number = nro_match.group(1)
    else:
        alt_match = re.search(r"(?:nro|factura|recibo|timbrado|n[úu]m[ée]ro)[\s\.:#-]*([0-9]{3}-[0-9]{3}-[0-9]{7}|[0-9]{4,10})", raw_text, re.IGNORECASE)
        if alt_match:
            doc_number = alt_match.group(1)

    cdc_match = re.search(r"(?:cdc|control)[\s\.:#-]*([0-9\s]{40,50})", raw_text, re.IGNORECASE)
    cdc_code = "".join(cdc_match.group(1).split()) if cdc_match else ""

    business_name = "Comercio Emisor"
    known_brands = [
        ("arete", "Supermercado Arete"),
        ("cafsa", "Supermercado Arete"),
        ("superseis", "Superseis"),
        ("stock", "Supermercados Stock"),
        ("biggie", "Biggie Express"),
        ("personal", "Personal Paraguay"),
        ("tigo", "Tigo Paraguay"),
        ("ande", "ANDE"),
        ("essap", "ESSAP"),
    ]
    for key, name in known_brands:
        if key in lower:
            business_name = name
            break
    
    if business_name == "Comercio Emisor" and len(lines) > 0:
        for l in lines[:3]:
            if len(l) > 4 and not any(w in l.upper() for w in {"RUC", "TIMBRADO", "FACTURA", "RECIBO", "CÓDIGO", "N°"}):
                business_name = l[:30]
                break

    amounts = []
    for line in lines:
        if any(k in line.lower() for k in ["total", "a pagar", "importe", "gs"]):
            nums = re.findall(r"\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\b", line)
            for n in nums:
                val = float(n.replace(".", "").replace(",", "."))
                if 1000 <= val <= 500000000:
                    amounts.append(val)

    if not amounts:
        for n in re.findall(r"\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?\b", raw_text):
            val = float(n.replace(".", "").replace(",", "."))
            if 1000 <= val <= 500000000:
                amounts.append(val)

    detected_amount = max(amounts) if amounts else 0.0

    is_exenta = any(k in lower for k in ["exentas", "exenta", "no gravado", "iva 0%"])
    is_gravada_5 = "5%" in lower or "5 por ciento" in lower

    gravada_10 = 0.0
    gravada_5 = 0.0
    exenta = 0.0

    if is_exenta:
        exenta = detected_amount
    elif is_gravada_5:
        gravada_5 = detected_amount
    else:
        gravada_10 = detected_amount if doc_type == "Factura" else 0.0

    # Marcar explícitamente en el concepto que viene del correo
    product_detail = f"[Correo Gmail] {doc_type} - {business_name}"

    detected_date = datetime.today().strftime("%Y-%m-%d")
    date_match = re.search(r"\b(\d{1,2})[/\.-](\d{1,2})[/\.-](\d{2,4})\b", raw_text)
    if date_match:
        d, m, y = date_match.group(1).zfill(2), date_match.group(2).zfill(2), date_match.group(3)
        if len(y) == 2: y = f"20{y}"
        try:
            detected_date = datetime(int(y), int(m), int(d)).strftime("%Y-%m-%d")
        except ValueError:
            pass

    return {
        "docType": doc_type,
        "documentNumber": doc_number,
        "cdc": cdc_code,
        "financialType": "expense",
        "amount": detected_amount,
        "gravada10": gravada_10,
        "gravada5": gravada_5,
        "exenta": exenta,
        "businessName": business_name,
        "productDetail": product_detail,
        "category": "Otros Gastos",
        "date": detected_date,
    }

@app.post("/process")
async def process_document(file: UploadFile = File(...)):
    contents = await file.read()
    raw_text = ""
    try:
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t: raw_text += t + "\n"
    except Exception as e:
        print("Error en PDF:", e)

    parsed = parse_extracted_text(raw_text)
    parsed["images"] = []
    return parsed

@app.post("/sync-mail")
async def sync_user_mail(payload: SyncMailRequest):
    found_transactions = []
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(payload.email.strip(), payload.password.strip())
        mail.select("inbox")

        # Configurar fechas de búsqueda (por días o rango personalizado)
        if payload.startDate:
            start_dt = datetime.strptime(payload.startDate, "%Y-%m-%d")
        else:
            start_dt = datetime.now() - timedelta(days=payload.days)

        search_query = f'(SINCE "{to_imap_date(start_dt)}")'
        status, messages = mail.search(None, search_query)
        email_ids = messages[0].split()

        # Revisar los últimos 30 correos coincidentes en la bandeja
        for e_id in reversed(email_ids[-30:]):
            status, msg_data = mail.fetch(e_id, "(RFC822)")
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    for part in msg.walk():
                        filename = part.get_filename() or ""
                        content_type = part.get_content_type()
                        if ".pdf" in filename.lower() or "pdf" in content_type:
                            file_bytes = part.get_payload(decode=True)
                            if file_bytes:
                                raw_text = ""
                                try:
                                    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                                        for p in pdf.pages:
                                            t = p.extract_text()
                                            if t: raw_text += t + "\n"
                                except Exception as e:
                                    print("Error leyendo PDF adjunto:", e)

                                parsed = parse_extracted_text(raw_text)
                                
                                # Filtrar también por fecha fin si se especificó un rango personalizado
                                if payload.endDate and parsed["date"] > payload.endDate:
                                    continue

                                if parsed.get("amount", 0) > 0:
                                    found_transactions.append(parsed)

        mail.close()
        mail.logout()
        return {"success": True, "count": len(found_transactions), "transactions": found_transactions}
    except Exception as e:
        print("Error en sync-mail:", e)
        return {"success": False, "error": str(e), "transactions": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8005)