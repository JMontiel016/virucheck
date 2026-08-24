from pydantic import BaseModel
import imaplib
import email
from email.header import decode_header
from datetime import datetime, timedelta

class SyncMailRequest(BaseModel):
    email: str
    password: str
    days: int = 60

@app.post("/sync-mail")
async def sync_user_mail(payload: SyncMailRequest):
    found_transactions = []
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(payload.email.strip(), payload.password.strip())
        mail.select("inbox")

        # Filtro de los últimos N días
        since_date = (datetime.now() - timedelta(days=payload.days)).strftime("%d-%b-%Y")
        status, messages = mail.search(None, f'(SINCE "{since_date}")')
        email_ids = messages[0].split()

        for e_id in email_ids[-20:]:  # Limita a los últimos 20 correos del rango para mayor rapidez
            status, msg_data = mail.fetch(e_id, "(RFC822)")
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    
                    # Buscar PDFs o comprobantes
                    for part in msg.walk():
                        content_type = part.get_content_type()
                        filename = part.get_filename() or ""
                        if "pdf" in content_type or filename.lower().endswith(".pdf") or "image" in content_type:
                            file_bytes = part.get_payload(decode=True)
                            if file_bytes:
                                # Procesar directamente con el motor interno
                                upload_file = UploadFile(filename=filename, file=io.BytesIO(file_bytes))
                                res = await process_document(upload_file)
                                if res.get("amount", 0) > 0:
                                    found_transactions.append(res)

        mail.close()
        mail.logout()
        return {"success": True, "count": len(found_transactions), "transactions": found_transactions}
    except Exception as e:
        print("Error en sync-mail:", e)
        return {"success": False, "error": str(e), "transactions": []}