# Insurance Intelligence Pipeline (IIP)

An asynchronous, containerized microservices platform that ingests insurance
documents and runs them through a three-stage AI pipeline to extract structured
data and **detect conflicts and inconsistencies** (mismatched identifiers,
impossible dates, claims exceeding coverage, name mismatches, PII exposure).

```
Upload (Frontend)  ->  API Gateway  ->  MongoDB job queue  ->  Processor Worker (polling)  ->  MongoDB
                                                                     |
                                        Textract (OCR) -> Comprehend (NLP) -> Bedrock / Claude Sonnet 4.5 (extraction + conflict detection)
```

## Why this design

Insurance intake is bursty. A synchronous "upload → analyze → respond" API stalls
under load and drops work. IIP **temporally decouples** ingestion from compute:
the API accepts uploads instantly (HTTP 202) and offloads the expensive
OCR/NLP/LLM work to an independent worker pool via a **MongoDB-backed job queue**
that workers poll. If the AI stage slows down or a document is malformed, the API
stays responsive and failed jobs are routed to a dead-letter state for auditing
instead of being lost.

The queue is intentionally simple — no Redis/BullMQ. Workers atomically claim the
next due `pending` job with a single `findOneAndUpdate`, process it, and mark it
`completed` or reschedule it with exponential backoff (up to `maxAttempts`, then
dead-letter). Stale locks from crashed workers are auto-recovered. This keeps the
infra footprint to just MongoDB while remaining safe across multiple worker replicas.

## Components

| Service      | Tech                              | Role |
|--------------|-----------------------------------|------|
| `frontend`   | React + Vite (nginx in Docker)    | Operator console: upload, live status, conflict review, queue viewer |
| `backend`    | Node.js + Express                 | Ingress API, enqueues jobs (Mongo), exposes document + queue status |
| `processor`  | Node.js + AWS SDK v3              | Polling worker: Textract → Comprehend → Bedrock pipeline, persists results |

> **MongoDB is external — MongoDB Atlas** (not a container). It stores documents,
> analysis results, **and** the job queue. Set `MONGO_URI` in `.env`.

## AWS services used

- **Amazon Textract** – OCR + form (key/value) extraction from the uploaded document.
- **Amazon Comprehend** – entities, PII detection, key phrases, sentiment, language.
- **Amazon Bedrock (Claude Sonnet 4.5)** – structured field extraction and conflict/inconsistency detection.

> The pipeline runs fully **offline in MOCK mode** (no AWS account needed) so you
> can demo it anywhere. Set `USE_MOCK=false` with credentials to hit real AWS.

## Quick start (Docker, mock mode — zero AWS needed)

```bash
cp .env.example .env      # set MONGO_URI to your Atlas string; USE_MOCK=auto -> mock without AWS
docker compose up --build
```

> Set `MONGO_URI` in `.env` to your MongoDB Atlas connection string first, and
> allow-list your IP in Atlas → Network Access. See [`docs/SETUP.md`](docs/SETUP.md).

Then, in a second terminal, generate and seed sample documents:

```bash
cd data-tool
npm install
npm run generate
npm run seed
```

Open the console at **http://localhost:8080** and watch documents move through
`OCR → NLP → LLM` and surface their conflicts.

## Quick start (real AWS)

1. Follow [`docs/AWS_SETUP.md`](docs/AWS_SETUP.md) (IAM permissions + Bedrock model access).
2. Put credentials in `.env` and set `USE_MOCK=false`.
3. `docker compose up --build`.

## Documentation

| Doc | Contents |
|-----|----------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, data flow, schema, trade-offs |
| [`docs/SETUP.md`](docs/SETUP.md) | Full setup: Docker and local (no Docker) |
| [`docs/AWS_SETUP.md`](docs/AWS_SETUP.md) | AWS credentials, IAM policy, Bedrock model access |

## API summary

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/api/documents` | Upload a document (`multipart/form-data`, field `document`) → 202 + `documentId` |
| GET    | `/api/documents` | List documents (status, risk, conflict count) |
| GET    | `/api/documents/:id` | Full analysis for one document |
| GET    | `/api/documents/:id/file` | Download the original upload |
| DELETE | `/api/documents/:id` | Remove a document |
| GET    | `/api/queue` | Job queue stats + recent jobs (powers the queue viewer) |
| GET    | `/api/queue/stats` | Job counts by status only |
| GET    | `/api/health` | Service + queue health |

## Ports

| Service | URL |
|---------|-----|
| Frontend (Docker) | http://localhost:8080 |
| Frontend (Vite dev) | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| MongoDB | external — MongoDB Atlas (`MONGO_URI`) |
