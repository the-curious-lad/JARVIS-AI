# JARVIS — Hacktoberfest Week 2 Challenge Submission Outline

## 1. The Problem
Most AI applications today suffer from three critical flaws:
1. **Unbounded Chatbots**: They generate natural language answers but cannot reliably coordinate multi-step workflows or guarantee task execution.
2. **Fragile State**: Workflows live in ephemeral memory and disappear on server reload.
3. **Amnesiac Interactions**: Assistants fail to learn consistent personal preferences across repeated sessions, forcing users to restate constraints repeatedly.

## 2. Intended Customer
Independent software engineers, freelancers, researchers, and knowledge workers who repeatedly perform complex, multi-step tasks across research, document preparation, email communications, and scheduling.

## 3. What Jarvis Does
Users tell Jarvis their high-level objective via typed input or spoken voice:
- Jarvis interprets the request using **Gemma**, an open-weight AI model.
- It consults the **Personal Context Engine** to incorporate historical preferences.
- It generates a multi-step DAG execution plan with explicit dependencies and typed inputs.
- It dispatches steps through a persistent **Action Queue** backed by MongoDB.
- Mini-Workers execute web research (**SerpApi**), generate exportable documents (**Markdown & DOCX**), draft contextual emails, or optimize schedules.
- Jarvis observes execution outcomes and extracts verified candidate memories for future interactions.

## 4. Why Gemma is Central
Gemma is the cognitive core of Jarvis:
- **Autonomous Planning**: Breaks down complex user requests into structured, validated steps.
- **Tool Selection**: Directs inputs strictly to registered, permissioned application tools.
- **Evidence Synthesis**: Synthesizes live web findings without hallucinating or inventing citations.
- **Candidate Memory Extraction**: Detects recurring user patterns and formatting preferences from task results.
- **Open-Weight Autonomy**: Allows local, cost-effective, private edge deployments without reliance on proprietary model locks.

## 5. How External Tools Complement Gemma
Under the non-negotiable principle:
> *"AI interprets and proposes. Application code validates and executes. The database preserves operational truth."*

- **SerpApi**: Provides grounded, real-time Google search results with organic links.
- **MongoDB Atlas**: Serves as the single operational source of truth. Task states, retry counts, approval flags, and memory provenance survive restarts.
- **Deterministic Scheduling Worker**: Application code (not the model) computes conflict overlaps, checks dependencies, and sorts calendars.
- **Native DOCX Engine**: Compiles structured documents directly into download-ready Microsoft Word binaries.

## 6. How the Personal Context Engine Works
- Extracts explicit preferences (`"Remember that I prefer concise technical documents"`) with 98% confidence.
- Discovers inferred preferences from repeated interactions.
- Performs deduplication and automatically upgrades inferred memories to explicit when directly confirmed.
- Grants users complete privacy control: inspect memories, see source interaction provenance, edit, delete, or wipe all records.

## 7. How Voice Improves Usability
- Incorporates **ElevenLabs** Turbo v2.5 text-to-speech for vocal updates and executive summaries.
- Provides browser SpeechRecognition microphone input for hands-free workflow initiation.
- Seamlessly falls back to Web Speech API `window.speechSynthesis` when external API credentials are absent.

## 8. What Was Actually Implemented & Verified
- [x] Full Next.js 14 / TypeScript / Tailwind CSS dashboard with 7 dedicated views: Assistant, Action Queue, Scheduler, Personal Memory, Documents, Observability, and Settings.
- [x] Gemma Model Provider abstraction with Groq, HuggingFace, Google Studio, Ollama, and offline Heuristic Dev engines.
- [x] Persistent MongoDB Action Queue with DAG dependency enforcement, bounded retries, and server restart recovery.
- [x] Research Worker with SerpApi Google Search and verified citation retention.
- [x] Document Worker with real-time Markdown preview, 1-click clipboard copy, and native `.docx` and `.md` file downloads.
- [x] Scheduling Worker with deterministic interval conflict detection and priority-based rescheduling.
- [x] Email Draft Worker with tone preference customization and safety approval gate.
- [x] Personal Context Engine with explicit vs. inferred memory classification and complete wipe controls.
- [x] Voice Interface with ElevenLabs TTS and Web Audio speech recognition.
- [x] Sentry correlation tracing (`traceId`, `planId`, `taskId`) and execution latency observability.
- [x] Automated test suite in Vitest: **21/21 tests passing** across all modules.
- [x] Production build (`npm run build`) compiled and optimized with 0 errors.

## 9. Remaining & Stretch Considerations
- Direct OAuth integrations with Google Calendar / Google Docs (scoped for post-hackathon v2 roadmap).
- Interruptible real-time duplex WebRTC speech-to-speech streaming.

## 10. Verification Evidence
- **Automated Tests**: 21 passed across 5 test suites (`tests/scheduler.test.ts`, `tests/contextEngine.test.ts`, `tests/tools.test.ts`, `tests/actionQueue.test.ts`, `tests/workers.test.ts`).
- **Production Build**: Verified clean static page optimization (`npm run build`).
- **Git Repository**: Initialized and committed on `main` at `C:\Users\hp\Desktop\JARVIS AI`.
