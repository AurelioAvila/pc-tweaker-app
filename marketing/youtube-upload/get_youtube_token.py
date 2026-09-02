"""
Rigenera token.json per il canale PC Tweaker dopo che il refresh token e'
scaduto/revocato. Riusa lo stesso client_secret gia' presente in questa
cartella. DA LANCIARE UNA SOLA VOLTA IN LOCALE.

NOTA (2026-08-04): questo script NON e' il percorso normale per rigenerare
token.json - lib.js ha un proprio flusso OAuth integrato (getNewToken) che
si attiva da solo quando token.json manca e scrive il file nel formato
esatto che il resto della pipeline Node si aspetta. Per aggiungere lo scope
Analytics, il modo piu' semplice e' cancellare token.json e rilanciare
qualunque script Node che chiama getAuthorizedClient() (es. node auto-
upload.js): si apre il browser da solo e il file viene riscritto corretto.
Questo script Python resta come alternativa manuale, ma il suo output va
poi convertito a mano nel formato di token.json (access_token/refresh_token/
scope/token_type/expiry_date) - piu' complicato, non serve se lib.js
funziona.
"""
from google_auth_oauthlib.flow import InstalledAppFlow

CLIENT_SECRET_FILE = "client_secret_303258065266-dut5kks1ak6hlcp40drarp07vh4fhhdq.apps.googleusercontent.com.json"
SCOPES = [
    "https://www.googleapis.com/auth/youtube",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
]

flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, SCOPES)
creds = flow.run_local_server(port=0)

print("\n=== NUOVO REFRESH TOKEN ===")
print("CLIENT_ID:", creds.client_id)
print("CLIENT_SECRET:", creds.client_secret)
print("REFRESH_TOKEN:", creds.refresh_token)
