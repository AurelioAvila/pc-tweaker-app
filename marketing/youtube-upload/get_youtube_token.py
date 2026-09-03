"""
Regenerates token.json for the PC Tweaker channel after the refresh token has
expired or been revoked. Reuses the same client_secret already present in this
folder. TO BE RUN ONCE, LOCALLY.

NOTE (2026-08-04): this script is NOT the normal path for regenerating
token.json - lib.js has its own built-in OAuth flow (getNewToken) that starts
by itself when token.json is missing and writes the file in exactly the format
the rest of the Node pipeline expects. To add the Analytics scope, the simplest
route is to delete token.json and re-run any Node script that calls
getAuthorizedClient() (e.g. node auto-upload.js): the browser opens on its own
and the file is rewritten correctly. This Python script remains as a manual
alternative, but its output then has to be converted by hand into token.json's
format (access_token/refresh_token/scope/token_type/expiry_date) - more
complicated, and unnecessary while lib.js works.
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
