# ⚡ JARVIS — Autonomous Personal AI Assistant
### Hacktoberfest AI Challenge (Week 2) Multi-Track Submission

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Gemma](https://img.shields.io/badge/Gemma_2-Google_DeepMind-orange?style=for-the-badge&logo=google)](https://ai.google.dev/gemma)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas_Vector_Search-green?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![SerpApi](https://img.shields.io/badge/SerpApi-Live_Google_Search-yellow?style=for-the-badge)](https://serpapi.com/)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-Voice_Turbo_v2.5-purple?style=for-the-badge)](https://elevenlabs.io/)
[![Sentry](https://img.shields.io/badge/Sentry-Telemetry_&_Tracing-red?style=for-the-badge&logo=sentry)](https://sentry.io/)
[![Render](https://img.shields.io/badge/Render-Cloud_Deployment-46E3B7?style=for-the-badge&logo=render)](https://render.com/)

> **"AI interprets and proposes. Application code validates and executes. The database preserves operational truth. The Personal Context Engine makes future interactions more relevant."**

Jarvis is **not** a chatbot wrapper or generic prompt chain. It is an autonomous personal AI assistant built on an explicit Copilot planner, deterministic task workers, a durable persistent Action Queue in MongoDB, and a bi-directional Personal Context Engine that continuously extracts and refines user preferences.

---

## 🏆 Hacktoberfest Week 2 Prize Targets (7 Categories)

Jarvis is architected to qualify and compete for **all 7 Hacktoberfest Week 2 prize tracks**:

| # | Prize Category | Partner / Sponsor | How Jarvis Uses It | Location in Repository |
|---|---|---|---|---|
| 👑 | **Grand Prize / Best Overall Project** | Hacktoberfest AI Challenge | Complete cohesive system: voice, planning, persistent queues, research, scheduling, and long-term memory | Entire Codebase |
| 1 | **Best Open-Weight AI Integration** | **Gemma (Google DeepMind)** | Core open-weight intelligence: request interpretation, multi-step planning, tool selection, synthesis, and candidate memory extraction | [`src/lib/ai/gemma.ts`](file:///src/lib/ai/gemma.ts) |
| 2 | **Best Web Search & Live Research** | **SerpApi** | Live Google Search integration with verified organic link extraction, factual cross-referencing, and anti-hallucination citations | [`src/lib/workers/researchWorker.ts`](file:///src/lib/workers/researchWorker.ts) |
| 3 | **Best Database & Vector Search** | **MongoDB Atlas** | Operational truth persistence (plans, action queue, documents) + **Atlas Vector Search** for semantic memory retrieval | [`src/lib/db/client.ts`](file:///src/lib/db/client.ts) & [`src/lib/memory/contextEngine.ts`](file:///src/lib/memory/contextEngine.ts) |
| 4 | **Best Voice AI & Audio Interface** | **ElevenLabs** | Spoken task summaries and voice playback using ElevenLabs Turbo v2.5 with audio streaming and microphone STT input | [`src/lib/voice/elevenlabs.ts`](file:///src/lib/voice/elevenlabs.ts) |
| 5 | **Best Cloud Deployment & DevOps** | **Render** | Production-ready infrastructure blueprint with 1-click cloud service deployment | [`render.yaml`](file:///render.yaml) |
| 6 | **Best Observability & Telemetry** | **Sentry** | End-to-end execution span monitoring, correlation IDs (`traceId`, `planId`, `taskId`), model latency, and error tracing | [`src/lib/observability/sentry.ts`](file:///src/lib/observability/sentry.ts) |

---

## 🏛️ System Architecture

```
                                  +---------------------------+
                                  |   User Interface / Voice  |
                                  |  (Next.js App / WebAudio) |
                                  +-------------+-------------+
                                                |
                                                v
                                  +---------------------------+
                                  |    Copilot / Autopilot    |
                                  |   (Open-weight: Gemma)    |
                                  +-------------+-------------+
                                                |
                      +-------------------------+-------------------------+
                      |                                                   |
                      v                                                   v
          +-----------------------+                           +-----------------------+
          | Personal Context      |                           |     Action Queue      |
          | Engine (MongoDB)      | <-----------------------+ |  (MongoDB Persistence)|
          +-----------------------+                           +-----------+-----------+
                                                                          |
                           +----------------------------------------------+
                           |                      |                       |
                           v                      v                       v
                 +------------------+   +-------------------+   +-------------------+
                 |  Research Worker |   |  Document Worker  |   | Scheduling Worker |
                 |  (SerpApi + Web) |   |  (MD / DOCX Gen)  |   | (Deterministic)   |
                 +------------------+   +-------------------+   +-------------------+
```

---

## 📦 Database Schemas & Collections

Jarvis uses **7 distinct MongoDB collections** (with transparent offline embedded file fallback for zero-credential local runs):

1. **`plans`**: Multi-step DAG execution plans generated by the Copilot (`id`, `userId`, `request`, `intendedOutcome`, `steps[]`, `status`, `verificationCriteria`).
2. **`tasks`**: Persistent Action Queue operational records (`id`, `planId`, `stepId`, `taskType`, `input`, `dependencies[]`, `status`, `attemptCount`, `maxAttempts`, `requiresApproval`, `result`).
3. **`scheduled_tasks`**: Deterministic commitments & deadlines (`id`, `title`, `priority`: `urgent` \| `high` \| `medium` \| `low`, `estimatedDuration`, `deadline`, `scheduledStart`, `scheduledEnd`, `status`).
4. **`memories`**: Long-term personal context (`id`, `userId`, `category`, `content`, `type`: `explicit` \| `inferred`, `confidence`, `sourceInteraction`, `embedding`).
5. **`memory_observations`**: Audit trail of raw candidate observations before deduplication.
6. **`documents`**: Deliverable library storing research reports and email drafts (`id`, `title`, `type`, `markdownContent`, `sources[]`).
7. **`traces`**: Observability telemetry spans capturing latencies and correlation IDs (`traceId`, `planId`, `taskId`, `spanName`, `durationMs`, `status`).

---

## ⚙️ Key Subsystems

### 1. Copilot / Autopilot
- Translates natural-language goals into structured execution plans.
- Dynamically injects personal user context and preferences retrieved from MongoDB.
- Validates model tool proposals against registered Zod schemas.

### 2. Mini-Workers
- **Research Worker**: Converts goals into targeted queries, queries **SerpApi**, extracts citations, and synthesizes source-grounded findings.
- **Document Worker**: Formats research into Markdown and builds native binary **Microsoft Word (`.docx`)** files using `docx`.
- **Email Draft Worker**: Drafts professional communications tailored to recipient tone preferences with an approval-before-sending safety gate.
- **Scheduling Worker**: Deterministic math logic for conflict detection, overdue monitoring, and priority rescheduling.

### 3. Personal Context Engine (with Atlas Vector Search)
- Extracts explicit facts (`"Remember that I prefer tables"`) with 98% confidence.
- Learns inferred preferences from repeated interactions.
- Avoids prompt bloat via semantic vector embeddings and Atlas Vector Search (`$vectorSearch`).
- Full user privacy controls (inspect, edit, delete, or wipe all memories).

### 4. Voice Interface
- First-class voice mode powered by **ElevenLabs Turbo v2.5** and browser `SpeechRecognition`.
- Automatic fallback to browser `speechSynthesis` when external API keys are omitted.

---

## 🚀 Quickstart & Setup

### 1. Prerequisites
- Node.js 18+ (tested on Node v22.17)
- npm 10+

### 2. Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd "JARVIS AI"

# Install dependencies
npm install

# Optional: configure environment variables
cp .env.example .env.local
```

### 3. Launch Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser. All features work immediately out-of-the-box with intelligent local development fallbacks!

### 4. Run Automated Test Suite
```bash
npm run test
```
**37/37 Unit and Integration Tests Pass** across 7 comprehensive test suites (Workers, Tools, Context Engine, Auth & Vector, Voice & Planner, Action Queue, Scheduler).

---

## 🌐 Environment Configuration (`.env.local`)

```env
# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/jarvis?retryWrites=true&w=majority
MONGODB_DB_NAME=jarvis

# Open-Weight AI (Gemma 2 / Gemma 3)
GEMMA_PROVIDER=ollama    # Options: "ollama" (local on-device), "groq", "google", "huggingface"
GEMMA_MODEL=gemma3:4b
OLLAMA_BASE_URL=http://localhost:11434

# Live Google Search (SerpApi)
SERPAPI_API_KEY=<your_serpapi_key>

# Voice AI (ElevenLabs)
ELEVENLABS_API_KEY=<your_elevenlabs_key>
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB  # Adam (works on free & paid tiers)

# Observability (Sentry)
NEXT_PUBLIC_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
```

---

## ☁️ Deployment on Render

This repository includes a production [`render.yaml`](file:///render.yaml) blueprint:
1. Push this repository to your [GitHub account](https://github.com/the-curious-lad/JARVIS-AI).
2. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Blueprint**.
3. Connect your `the-curious-lad/JARVIS-AI` repository.
4. Render automatically parses `render.yaml` and requests any private environment variables:
   - `MONGODB_URI`: Your MongoDB Atlas connection string.
   - `SERPAPI_API_KEY`: Your SerpApi API key.
   - `ELEVENLABS_API_KEY`: Your ElevenLabs API key.
   - `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN`: Your Sentry DSN.
   - `GROQ_API_KEY` or `GOOGLE_API_KEY`: For cloud Gemma open-weight inference.
5. Click **Apply** — Render automatically builds and hosts JARVIS live on the internet!

