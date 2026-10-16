# JARVIS AI — System Architecture Specification
**Hacktoberfest Week 2 Challenge**

## 1. System Overview

Jarvis is a personal AI assistant built on the principle:
> **"AI interprets and proposes. Application code validates and executes. The database preserves operational truth. The Personal Context Engine makes future interactions more relevant."**

Jarvis does not allow unconstrained language models to execute arbitrary shell scripts or code. Instead, it features an explicit Copilot planner, deterministic task workers, a durable persistent Action Queue, and a bi-directional Personal Context Engine.

```
                           +---------------------------+
                           |  User Interface / Voice   |
                           |  (Next.js App / WebAudio) |
                           +-------------+-------------+
                                         |
                                         v
                           +---------------------------+
                           |   Copilot / Autopilot     |
                           |  (Open-weight: Gemma)     |
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

## 2. Core Subsystems

### A. Copilot / Autopilot
- Interprets natural language requests and retrieves personal context.
- Generates structured, validated plans with typed steps, explicit dependencies, required tools, and approval flags.
- Validates model output against strict Zod schemas.
- Re-plans on recoverable failure and requests confirmation for sensitive actions.

### B. Mini-Workers
- **Research Worker**: Converts user objectives into targeted search queries, invokes SerpApi, extracts page snippets, cross-verifies facts, and synthesizes structured reports with source citations.
- **Document Worker**: Turns research and synthesis into structured markdown and native `.docx` files with headings, tables, callouts, and sources.
- **Email Draft Worker**: Drafts professional communications respecting tone, conciseness, and recipient preferences without sending automatically.
- **Scheduling Worker**: Manages deadlines, priority sorting, time estimation, conflict detection, and rescheduling using deterministic application logic.

### C. Persistent Action Queue
- Source of operational truth in MongoDB.
- Tracks task lifecycle: `draft`, `ready`, `running`, `waiting_approval`, `completed`, `failed`, `cancelled`, `retry_pending`.
- Executes tasks only when prerequisites/dependencies are fulfilled.
- Provides restart recovery so uninterrupted execution resumes after server restart.
- Implements bounded retries with exponential backoff and idempotency keys.

### D. Personal Context Engine
- Pipeline: Task Result -> Observation -> Extraction -> Schema Validation -> Deduplication -> Confidence Scoring -> Memory Store.
- Strictly separates **Explicit Facts/Preferences** from **Inferred Observations**.
- Privacy controls: user inspection, manual correction, deletion, and complete memory wipe.
- Scoped to user ID with strict multi-tenant isolation.

### E. Voice Interface
- First-class audio experience powered by ElevenLabs TTS and Web Speech / Whisper transcription.
- Seamless fallback to Web Speech API when external API keys are not supplied.

### F. Observability (Sentry)
- Correlation IDs (`requestId`, `planId`, `taskId`, `toolCallId`) linked across client and server.
- Execution traces showing latency, model prompt/token metrics, tool runtimes, and failure causes.

---

## 3. Technology Stack

- **Frontend & App Framework**: Next.js 14/15 (App Router), React 18, Tailwind CSS, Lucide Icons
- **Language**: TypeScript
- **Database**: MongoDB Atlas (with seamless in-memory fallback for offline/development)
- **AI Core**: Gemma (open-weight model abstraction supporting Google AI Studio, Groq, Ollama, HuggingFace, and Local/Mock provider)
- **Search Provider**: SerpApi (with mock fixtures for reliable offline tests)
- **Voice**: ElevenLabs TTS & Web Speech API
- **Document Generation**: Markdown & native `docx` library
- **Observability**: Sentry SDK
- **Testing**: Vitest unit & integration test suite
