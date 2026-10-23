# Cloudflare deployment

Worker on **Amanshah0844@gmail.com** Cloudflare account (`account_id` in `wrangler.jsonc`).

| Item | Value |
|------|--------|
| Worker | `night-shift-team-hub` |
| URL | https://night-shift-team-hub.kiritokris.workers.dev |
| Cron | Every 15 minutes (`*/15 * * * *`) |
| Storage | KV namespace `HUB` |

## Auth

All routes except `/health` require:

```http
Authorization: Bearer <HUB_TOKEN>
```

Token is set via `wrangler secret put HUB_TOKEN` (not in git). Efi shares it with Izia out of band.

## Deploy / update

```bash
./scripts/cloud-deploy.sh   # from repo root
# or
cd cloudflare && npm install && npx wrangler deploy
```

## Sync markdown from laptops

After you edit LIVE, ACTION-ITEMS, etc. locally:

```bash
./scripts/cloud-sync.sh
```

This POSTs to `/api/sync` and runs a cloud evaluation tick.

## Local dev

```bash
cd cloudflare
npx wrangler dev
```

Set `HUB_TOKEN` in `cloudflare/.dev.vars` for local testing.
