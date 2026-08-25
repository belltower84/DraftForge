# Optional DraftForge Server

The core DraftForge app is static and does not need this folder.

Use the server only when adding secret-backed integrations such as Yahoo OAuth or server-side screenshot analysis.

```bash
cd server
npm install
npm start
```

Open `http://localhost:3000`.

The starter endpoints intentionally return `501 Not Configured` until a provider is implemented. Keep all credentials in environment variables and keep `.env` out of Git.
