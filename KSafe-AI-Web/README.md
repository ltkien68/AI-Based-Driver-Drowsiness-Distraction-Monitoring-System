# KSafe AI Dashboard

Frontend prototype for the KSafe AI driver monitoring system.

## Run locally
Open this folder in VS Code and use the Live Server extension on `index.html`, or run a local static server:

```bash
python -m http.server 5500
```

Then open `http://localhost:5500`.

## Demo vs real data
The UI starts in DEMO mode. It does not claim the ESP32 or Python AI is connected unless a real request to the configured ESP32 API succeeds.

Configure the ESP32 base URL in Settings. The ESP32 should expose:
- `GET /api/status`
- `POST /api/state`

## Notes
- HTML, CSS and vanilla JavaScript only.
- Lucide icons and Google Fonts are loaded from CDNs.
- Browser-to-ESP32 requests require correct CORS response headers on the ESP32.
