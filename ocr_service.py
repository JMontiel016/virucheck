from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import pdfplumber
from pdf2image import convert_from_bytes
import pytesseract
from PIL import Image
import io
import re
import imaplib
import email
from email.header import decode_header
from datetime import datetime, timedelta
import base64

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class SyncByDocRequest(BaseModel):
    email: str
    password: str
    documentNumber: str = "5265619"
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    days: int = 60

MONTHS_EN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

def to_imap_date(dt: datetime) -> str:
    return f"{dt.day:02d}-{MONTHS_EN[dt.month - 1]}-{dt.year}"

def parse_extracted_text(raw_text: str):
    lower = raw_text.lower()
    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]

    # 1. Tipo de Documento Fiscal Exacto
    doc_type = "Factura"
    if any(k in lower for k in ["nota de credito", "nota de crédito", "nc nro"]):
        doc_type = "Nota de Crédito"
    elif any(k in lower for k in ["nota de remision", "remisión", "nota de remisión"]):
        doc_type = "Nota de Remisión"
    elif any(k in lower for k in ["recibo", "recibí de", "recibi de", "transferencia"]):
        doc_type = "Recibo"
    elif any(k in lower for k in ["ticket", "no valido como factura", "resumen de compra"]):
        doc_type = "Ticket"

    # 2. Número de Documento en formato exacto (ej: 001-001-0000001)
    doc_number = "S/N"
    nro_match = re.search(r"\b([0-9]{3}-[0-9]{3}-[0-9]{7})\b", raw_text)
    if nro_match:
        doc_number = nro_match.group(1)
    else:
        alt_match = re.search(r"(?:nro|factura|recibo|timbrado|n[úu]m[ée]ro)[\s\.:#-]*([0-9]{3}-[0-9]{3}-[0-9]{7}|[0-9]{4,10})", raw_text, re.IGNORECASE)
        if alt_match:
            doc_number = alt_match.group(1)

    # 3. Código CDC (44 dígitos)
    cdc_match = re.search(r"(?:cdc|control)[\s\.:#-]*([0-9\s]{40,50})", raw_text, re.IGNORECASE)
    cdc_code = "".join(cdc_match.group(1).split()) if cdc_match else ""

    # 4. Emisor / Comercio
    business_name = "Comercio Emisor"
    known_brands = [
        ("cafsa", "Supermercado Arete"),
        ("arete", "Supermercado Arete"),
        ("superseis", "Superseis"),
        ("stock", "Supermercados Stock"),
        ("biggie", "Biggie Express"),
        ("personal", "Personal Paraguay"),
        ("tigo", "Tigo Paraguay"),
        ("ande", "ANDE"),
        ("essap", "ESSAP"),
        ("universidad", "Universidad / Institución"),
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

    # 5. Monto Total y Desglose (Gravada 10%, Gravada 5%, Exenta)
    amounts = []
    for line in lines:
        if any(k in line.lower() for k in ["total de la operación", "total a pagar", "total general", "total gs", "total:", "importe total"]):
            nums = re.findall(r"\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\b", line)
            for n in nums:
                val = float(n.replace(".", "").replace(",", "."))
                if 500 <= val <= 500000000:
                    amounts.append(val)

    if not amounts:
        for n in re.findall(r"\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\b", raw_text):
            val = float(n.replace(".", "").replace(",", "."))
            if 1000 <= val <= 500000000:
                amounts.append(val)

    detected_amount = max(amounts) if amounts else 0.0

    # Detección de si es Exenta
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

    # 6. Detalle del Producto / Ítem
    product_detail = f"{doc_type} - {business_name}"
    for line in lines:
        upper_line = line.upper()
        if any(h in upper_line for h in ["CÓDIGO", "CÓD.", "UNID", "CANTIDAD", "PRECIO", "DESCUENTO", "VALOR DE VENTA"]):
            continue
        if any(w in upper_line for w in ["ARANCEL", "PAGO", "CUOTA", "MATRICULA", "SERVICIO", "MENSUALIDAD", "COMPRA", "MENSUAL", "PRODUCTO"]):
            if len(line) > 3:
                product_detail = line
                break

    # 7. Fecha de Emisión
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
        "category": "Tecnología y Suscripciones" if "arancel" in product_detail.lower() else "Otros Gastos",
        "date": detected_date,
    }

@app.post("/process")
async def process_document(file: UploadFile = File(...)):
    contents = await file.read()
    raw_text = ""
    filename_lower = (file.filename or "").lower()
    images_base64 = []
    
    try:
        if filename_lower.endswith(".pdf"):
            with pdfplumber.open(io.BytesIO(contents)) as pdf:
                for page in pdf.pages:
                    t = page.extract_text()
                    if t: raw_text += t + "\n"
            
            pil_images = convert_from_bytes(contents)
            for img in pil_images:
                buffered = io.BytesIO()
                img.save(buffered, format="PNG")
                img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
                images_base64.append(f"data:image/png;base64,{img_str}")
        else:
            image = Image.open(io.BytesIO(contents))
            raw_text = pytesseract.image_to_string(image, lang="spa")
            buffered = io.BytesIO()
            image.save(buffered, format="PNG")
            images_base64.append(f"data:image/png;base64,{base64.b64encode(buffered.getvalue()).decode('utf-8')}")
    except Exception as e:
        print("Error:", e)

    parsed = parse_extracted_text(raw_text)
    parsed["images"] = images_base64
    return parsed

@app.post("/sync-mail")
async def sync_user_mail_by_doc(payload: SyncByDocRequest):
    found_transactions = []
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(payload.email.strip(), payload.password.strip())
        mail.select("inbox")

        start_dt = datetime.strptime(payload.startDate, "%Y-%m-%d") if payload.startDate else datetime.now() - timedelta(days=payload.days)
        status, messages = mail.search(None, f'(SINCE "{to_imap_date(start_dt)}")')
        email_ids = messages[0].split()
        doc_filter = payload.documentNumber.strip()

        for e_id in reversed(email_ids[-30:]):
            status, msg_data = mail.fetch(e_id, "(RFC822)")
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    for part in msg.walk():
                        filename = part.get_filename() or ""
                        content_type = part.get_content_type()
                        if any(ext in filename.lower() for ext in [".pdf", ".png", ".jpg"]) or "pdf" in content_type:
                            file_bytes = part.get_payload(decode=True)
                            if file_bytes:
                                images_base64 = []
                                raw_text = ""
                                if filename.lower().endswith(".pdf") or "pdf" in content_type:
                                    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                                        for p in pdf.pages:
                                            t = p.extract_text()
                                            if t: raw_text += t + "\n"
                                    for img in convert_from_bytes(file_bytes):
                                        buffered = io.BytesIO()
                                        img.save(buffered, format="PNG")
                                        images_base64.append(f"data:image/png;base64,{base64.b64encode(buffered.getvalue()).decode('utf-8')}")
                                else:
                                    image = Image.open(io.BytesIO(file_bytes))
                                    raw_text = pytesseract.image_to_string(image, lang="spa")
                                    buffered = io.BytesIO()
                                    image.save(buffered, format="PNG")
                                    images_base64.append(f"data:image/png;base64,{base64.b64encode(buffered.getvalue()).decode('utf-8')}")

                                if not doc_filter or doc_filter in raw_text:
                                    parsed = parse_extracted_text(raw_text)
                                    if parsed.get("amount", 0) > 0:
                                        parsed["images"] = images_base64
                                        found_transactions.append(parsed)

        mail.close()
        mail.logout()
        return {"success": True, "count": len(found_transactions), "transactions": found_transactions}
    except Exception as e:
        return {"success": False, "error": str(e), "transactions": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8005)