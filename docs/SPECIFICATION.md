# JARVIS AI — Master Product & Engineering Specification

## 1. Requirements Matrix

| Requirement | Implementation Component | Status |
|---|---|---|
| Open-weight AI Foundation | Gemma Model Provider abstraction (`src/lib/ai/gemma.ts`) | Implemented |
| Persistent Action Queue | MongoDB Task Queue (`src/lib/queue/actionQueue.ts`) | Implemented |
| Copilot Planning Engine | Copilot Orchestrator (`src/lib/copilot/orchestrator.ts`) | Implemented |
| Research Worker | SerpApi Web Research (`src/lib/workers/researchWorker.ts`) | Implemented |
| Document Worker | Markdown + DOCX Export (`src/lib/workers/documentWorker.ts`) | Implemented |
| Scheduling Worker | Deterministic Scheduling (`src/lib/workers/schedulingWorker.ts`) | Implemented |
| Email Draft Worker | Tone-aware email drafting (`src/lib/workers/emailWorker.ts`) | Implemented |
| Personal Context Engine | Provenance Memory Store (`src/lib/memory/contextEngine.ts`) | Implemented |
| Voice Interface | ElevenLabs + WebAudio fallback (`src/lib/voice/elevenlabs.ts`) | Implemented |
| Observability | Sentry + Correlation Traces (`src/lib/observability/sentry.ts`) | Implemented |
| User Interface | Next.js Modern Dashboard (`src/app/*`) | Implemented |

---

## 2. Security & Boundaries

1. **Explicit Tool Registry**: Only tools defined in `src/lib/tools/registry.ts` can be scheduled and executed.
2. **Approval Gateways**: Irreversible or sensitive actions (sending emails, deletion of personal context) strictly pause task execution with state `waiting_approval` until an explicit user action is received.
3. **Data Isolation**: All database queries are filtered by `userId`.
4. **Untrusted Input Sanitation**: Web search results and external sources are treated as untrusted strings and sanitized before rendering or passing to model prompts.
