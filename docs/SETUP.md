# Setup Guide

Two ways to run IIP:
- **A. Docker Compose** (recommended — one command brings up everything)
- **B. Local dev** (run each service with Node; nice for hot-reload and debugging)

Both support **mock mode** (no AWS) and **AWS mode** (real Textract/Comprehend/Bedrock).

## Prerequisites

| Tool | Version | Needed for |
|------|---------|-----------|
| Docker Desktop | latest | Option A |
| Node.js | 20+ | Option B + the data-tool |
| MongoDB Atlas | — | Always (external database + job queue) |
| AWS account | — | AWS mode only (see `AWS_SETUP.md`) |

> **MongoDB is external (Atlas).** It is no longer bundled as a container. Create
> a (free-tier is fine) Atlas cluster, add a database user, allow-list your IP
> under **Network Access**, and copy the SRV connection string into `MONGO_URI`
> in `.env`. A local `mongodb://localhost:27017/...` URI also works if you prefer.

---

## A. Docker Compose

### 1. Configure environment

```bash
cp .env.example .env
```

- **MongoDB (required):** set `MONGO_URI` to your Atlas SRV connection string
  (including the `insurance_db` database name). This is needed in every mode.
- **Mock mode (default):** leave `USE_MOCK=auto` and AWS keys blank. No AWS needed.
- **AWS mode:** set `USE_MOCK=false`, fill `AWS_REGION`, `AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY` (and `AWS_SESSION_TOKEN` if temporary). See `AWS_SETUP.md`.

### 2. Launch

```bash
docker compose up --build
```

You should see: `iip_backend` (port 3000), `iip_processor` (prints "Polling queue
online … provider=mock|aws"), and `iip_frontend` (port 8080). There is no Redis
and no Mongo container — the database and job queue live in your Atlas cluster.

### 3. Use it

Open **http://localhost:8080**. Upload a document (or watch the seeded ones)
and see them flow through `OCR → NLP → LLM` with conflicts highlighted.

### Tear down

```bash
docker compose down          # stop containers (Atlas data is untouched)
docker compose down -v        # also wipe the local uploads volume
```

> Your documents/jobs live in Atlas, so `down -v` only clears uploaded files.
> To reset the data, drop the `insurance_db` collections in Atlas.

---

## B. Local dev (no Docker for the app)

Use your Atlas cluster (or a local MongoDB you run yourself). Point every service
at the same `MONGO_URI`. Run each service in a separate terminal:

```bash
# Backend
cd backend
npm install
MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/insurance_db" UPLOAD_DIR=./data/uploads npm start
```

```bash
# Processor (mock mode)
cd processor
npm install
MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/insurance_db" UPLOAD_DIR=./data/uploads USE_MOCK=true npm start
```

> Windows PowerShell uses different env syntax:
> ```powershell
> $env:USE_MOCK="true"; $env:MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/insurance_db"; npm start
> ```

```bash
# Frontend (Vite dev server with API proxy -> localhost:3000)
cd frontend
npm install
npm run dev          # http://localhost:5173
```

> ⚠️ In local dev, the backend and processor must share the same `UPLOAD_DIR` so
> the worker can read files the API wrote. Use an absolute path both point to.

For AWS mode locally, set on the **processor**:

```bash
USE_MOCK=false AWS_REGION=us-east-1 AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... npm start
```

---

## Configuration reference

| Variable | Default | Applies to | Meaning |
|----------|---------|-----------|---------|
| `USE_MOCK` | `auto` | processor | `auto`=AWS if creds present else mock; `true`/`false` to force |
| `AWS_REGION` | `us-east-1` | processor | AWS region |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | — | processor | Credentials for AWS mode |
| `AWS_SESSION_TOKEN` | — | processor | For temporary/STS credentials |
| `BEDROCK_MODEL_ID` | `global.anthropic.claude-sonnet-4-5-20250929-v1:0` | processor | Bedrock model / inference profile |
| `WORKER_CONCURRENCY` | `2` | processor | Parallel documents |
| `MONGO_URI` | — (**required**) | backend, processor | MongoDB Atlas SRV connection string (include the `insurance_db` db name) |
| `POLL_INTERVAL_MS` | `1000` | processor | How often the worker polls MongoDB for jobs |
| `STALE_LOCK_MS` | `60000` | processor | Reclaim jobs stuck `active` past this (crashed worker) |
| `JOB_MAX_ATTEMPTS` | `3` | backend, processor | Retries before a job is dead-lettered |
| `UPLOAD_DIR` | `/data/uploads` | backend, processor | Shared upload storage |
| `PORT` | `3000` | backend | API port |
| `MAX_UPLOAD_BYTES` | `10485760` | backend | Upload size cap (Textract sync limit) |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Documents stuck at `queued` | Processor isn't running / can't reach MongoDB. Check `docker compose logs processor` (should log "Polling queue online"). |
| `MongooseServerSelectionError` / connection timeout | Atlas IP allow-list is blocking you, or `MONGO_URI` is wrong. Add your IP under Atlas **Network Access** and verify the SRV string + password. |
| Processor logs `provider=mock` but you wanted AWS | Set `USE_MOCK=false` and provide credentials; restart. |
| `AccessDeniedException` from Bedrock | Request model access + add IAM `bedrock:InvokeModel` for the inference profile (see `AWS_SETUP.md`). |
| `UnsupportedDocumentException` from Textract | Use a JPEG/PNG/PDF/TIFF under 10 MB. Multi-page PDFs are split per page automatically; images/TIFF must be single-page. |
| Worker reads no file in local dev | Backend and processor must share the same absolute `UPLOAD_DIR`. |
| Frontend can't reach API in dev | Ensure backend is on `:3000` (Vite proxies `/api`). |
