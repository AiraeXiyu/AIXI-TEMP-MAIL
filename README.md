# AIXI TEMP MAIL

Cloudflare Worker version of the Temp Mail REST API.

## Deploy

Cloudflare build/deploy command:

```bash
npx wrangler deploy
```

Worker entry point:

```text
worker.js
```

Configuration:

```text
wrangler.jsonc
```

## Endpoints

- GET /api
- GET /api/gen
- GET /api/use?user=<name>
- GET /api/inbox?user=<name>
- GET /api/read?user=<name>&index=<1|key>
- GET /api/dump?user=<name>
- GET /api/stream?user=<name>

The Worker uses the upstream API configured in `worker.js`:

https://akunlama.com/api
