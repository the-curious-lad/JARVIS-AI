export interface ModelCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface ModelProvider {
  name: string;
  isMock: boolean;
  generateText(prompt: string, options?: ModelCompletionOptions): Promise<string>;
  generateStructured<T>(prompt: string, schemaDescription: string, fallbackGenerator?: () => T): Promise<T>;
}

// 1. Mock / Local Development Provider with intelligent heuristics for offline reliability
export class MockGemmaProvider implements ModelProvider {
  name = 'Gemma-2-9b-it (Local Dev Heuristic Engine)';
  isMock = true;

  async generateText(prompt: string, options?: ModelCompletionOptions): Promise<string> {
    const p = prompt.toLowerCase();
    let userReq = '';
    const reqMatch = prompt.match(/(?:User Request|Search Query):\s*"([^"]+)"/i);
    if (reqMatch) userReq = reqMatch[1].toLowerCase().trim();

    // Extract callsign if provided in persona prompt
    let callsign = 'Sir';
    const callsignMatch = prompt.match(/(?:addressing the user as|Callsign:)\s*"([^"]+)"/i);
    if (callsignMatch) callsign = callsignMatch[1];

    const isResearchWorker = prompt.includes('You are Jarvis Research Worker') || prompt.includes('Synthesize the findings');
    const q = userReq || p;

    // 1. Gratitude & Politeness
    if (!isResearchWorker && (q.includes('thank') || q.includes('thanks') || q.includes('appreciate'))) {
      return `You are most welcome, ${callsign}. Always at your service.`;
    }

    // 2. Greetings
    if (!isResearchWorker && (q === 'hello' || q === 'hi' || q === 'hey' || q.includes('good morning') || q.includes('good evening') || q === 'hey hey jarvis')) {
      return `Good day, ${callsign}. All systems are fully operational. How may I be of service?`;
    }

    // 3. Calendar & Task Queries
    if (!isResearchWorker && (q.includes('task') || q.includes('schedule') || q.includes('calendar') || q.includes('event') || q.includes('work schedule'))) {
      const isCreateOrBook = q.includes('schedule an') || q.includes('schedule a') || q.includes('book') || q.includes('interview') || q.includes('meeting') || q.includes('add') || q.includes('create') || q.includes('set up') || q.includes('arrange');
      if (isCreateOrBook) {
        return `I have scheduled the requested commitment on your calendar, ${callsign}. All timeline parameters have been verified.`;
      }
      const hasEmptySchedule = prompt.includes('"overdueTasks":[]') || prompt.includes('"recommendedSchedule":[]');
      if (hasEmptySchedule) {
        return `You have no tasks or schedule conflicts for today, ${callsign}. Your calendar is completely clear.`;
      }
      return `I have reviewed your active task schedule, ${callsign}. Your commitments are aligned on your timeline.`;
    }

    // 4. System Status & Health
    if (!isResearchWorker && (q.includes('status') || q.includes('diagnostics') || q.includes('health') || q.includes('telemetry'))) {
      return `All systems are nominal, ${callsign}. Arc reactor is stable, personal context is active, and action copilot is ready.`;
    }

    // 5. Travel & Flight Inquiries (Lisbon, airlines, tickets, hotels)
    const isFlightOrTravel = q.includes('flight') || q.includes('lisbon') || q.includes('travel') || q.includes('ticket') || q.includes('airline') || q.includes('airport') || q.includes('trip') || q.includes('portugal') || q.includes('hotel');
    if (isFlightOrTravel) {
      if (prompt.includes('You are J.A.R.V.I.S.') || prompt.includes('spoken response')) {
        return `I have researched the flight options to Lisbon Portela Airport for 5 days from now, ${callsign}. Direct options with TAP Air Portugal and Ryanair average between €85 and €155. I have compiled the complete flight dossier and booking recommendations in your documents deck.`;
      }
      return `### Flight Intelligence & Travel Dossier: Lisbon, Portugal\n\n**Departure Window**: 5 days from today\n**Destination**: Humberto Delgado Airport (LIS), Lisbon, Portugal\n\n#### 1. Price & Carrier Comparison\n- **Ryanair / easyJet (Budget Direct)**: **€85 – €110** (Terminal 2 departures; standard 10kg underseat bag included, cabin trolley bag requires priority add-on).\n- **TAP Air Portugal (Direct Flag Carrier)**: **€130 – €155** (Terminal 1; includes standard carry-on and overhead locker access).\n- **Lufthansa / Air France / KLM (1-Stop Connections)**: **€160 – €195** (Via Frankfurt, Paris-CDG, or Amsterdam).\n\n#### 2. Pricing Dynamics & Timing Warning\n- **Optimal Booking Window**: Booking within the 4 to 6-day window is critical before the exponential 72-hour last-minute airline pricing surge kicks in.\n- **Cheapest Departure Slots**: Early morning flights (06:00 – 07:30) and late evening flights (after 20:30) consistently show the lowest median rates.\n\n#### 3. Transit & Arrival Information\n- **Airport Metro**: The Aeroporto station (Red Line / Linha Vermelha) is integrated with Terminal 1. Travel time to central Lisbon (Saldanha / Baixa-Chiado) is ~20 minutes (€1.80 ticket).\n- **Rideshare / Taxi**: Uber and Bolt operate from the departures level Kiss & Fly area (~€12–€18 to central Lisbon).`;
    }

    // 6. Research Queries (AI, open-weight models, benchmarks)
    if (q.includes('research') || q.includes('benchmark') || q.includes('compare') || q.includes('investigate') || q.includes('search')) {
      if (prompt.includes('You are J.A.R.V.I.S.') || prompt.includes('spoken response')) {
        if (q.includes('model') || q.includes('ai') || q.includes('gemma') || q.includes('llama')) {
          return `I have completed the research across open-weight models including Gemma 2, Llama 3.1, and Mistral, and synthesized the comparison report for you, ${callsign}.`;
        }
        return `I have conducted research on your query, ${callsign}. The synthesized report with verified sources is now ready in your documents deck.`;
      }
      return `### Overview of Open-Weight AI Models\n\nRecent open-weight models such as **Gemma 2**, **Llama 3.1**, and **Mistral** offer state-of-the-art reasoning, competitive benchmark performance, and permissible licensing for personal and enterprise deployment.\n\n- **Gemma 2 (9B / 27B)**: Built by Google DeepMind with architectural innovations like alternating local/global attention and knowledge distillation. Offers outstanding code and logic reasoning.\n- **Llama 3.1 (8B / 70B)**: Broad ecosystem support and strong general instruction following.\n- **Mistral 7B / NeMo 12B**: Efficient sliding window attention, low latency footprint.`;
    }

    // 7. Email Drafts
    if (q.includes('email') || q.includes('draft') || q.includes('letter')) {
      if (prompt.includes('You are J.A.R.V.I.S.') || prompt.includes('spoken response')) {
        return `I have drafted the project update email for your review, ${callsign}. It is ready in your documents deck.`;
      }
      return `Subject: Update Regarding Project Plan and Next Steps\n\nHi Team,\n\nI wanted to share a brief update on our progress. We have reviewed the initial research and scheduled the upcoming milestones. Let me know if you would like any adjustments.\n\nBest regards,\nJarvis`;
    }

    // 8. Spoken conversational synthesis fallback
    if (prompt.includes('You are J.A.R.V.I.S.') || prompt.includes('spoken response')) {
      if (userReq) {
        return `I have processed your inquiry regarding "${reqMatch ? reqMatch[1] : userReq}", ${callsign}. The intelligence synthesis and execution steps are prepared for your review.`;
      }
      return `All requested operations have been successfully executed, ${callsign}.`;
    }

    // 9. General substantive fallback
    if (userReq) {
      return `I have analyzed your request regarding "${reqMatch ? reqMatch[1] : userReq}". The necessary execution steps have been logged in your action queue and verified against your system parameters.`;
    }

    return `Directive processed, ${callsign}. All parameters are verified and aligned with your profile.`;
  }

  async generateStructured<T>(prompt: string, schemaDescription: string, fallbackGenerator?: () => T): Promise<T> {
    const p = prompt.toLowerCase();

    // Extract user request from structured prompt template if present
    let userReq = '';
    const reqMatch = prompt.match(/User Request:\s*"([^"]+)"/i);
    if (reqMatch) {
      userReq = reqMatch[1].toLowerCase().trim();
    } else {
      userReq = p;
    }

    // Planning requests
    const isPlanning = schemaDescription.toLowerCase().includes('plan') || p.includes('plan') || p.includes('steps') || p.includes('orchestrate') || p.includes('copilot');
    if (isPlanning) {
      const q = userReq;

      if (q.includes('research') || q.includes('search') || q.includes('benchmark') || q.includes('compare') || q.includes('investigate') || q.includes('look up')) {
        return {
          intendedOutcome: `Conduct comprehensive research on "${userReq}" and synthesize structured report.`,
          verificationCriteria: 'Valid research findings with verified sources, side-by-side comparison table, and formatted markdown export.',
          steps: [
            {
              id: 'step_1',
              title: `Search live sources for ${userReq}`,
              worker: 'research',
              tool: 'research_search',
              dependencies: [],
              input: { query: userReq || 'open-weight AI models 2026' },
              expectedOutput: 'Structured search results with source titles and URLs',
              requiresApproval: false,
              retryPolicy: { maxRetries: 2, retryCount: 0 }
            },
            {
              id: 'step_2',
              title: 'Synthesize research report and save document',
              worker: 'document',
              tool: 'document_create',
              dependencies: ['step_1'],
              input: {
                title: `Intelligence Report: ${userReq.slice(0, 40) || 'AI Research'}`,
                type: 'research_report'
              },
              expectedOutput: 'Formatted document with source citations',
              requiresApproval: false,
              retryPolicy: { maxRetries: 2, retryCount: 0 }
            }
          ]
        } as unknown as T;
      }

      if (q.includes('schedule') || q.includes('task') || q.includes('deadline') || q.includes('calendar') || q.includes('todo')) {
        const isCreate = q.includes('schedule an') || q.includes('schedule a') || q.includes('book') || q.includes('interview') || q.includes('meeting') || q.includes('add') || q.includes('create') || q.includes('set up') || q.includes('arrange');
        if (isCreate) {
          return {
            intendedOutcome: `Schedule commitment: "${userReq}"`,
            verificationCriteria: 'Calendar event created and verified on timeline.',
            steps: [
              {
                id: 'step_1',
                title: `Schedule commitment: ${userReq.slice(0, 50)}`,
                worker: 'scheduling',
                tool: 'schedule_manage',
                dependencies: [],
                input: {
                  action: 'create',
                  title: userReq.replace(/^(?:okay|hey|please|can you|jarvis|schedule|an|a)\s+/gi, '').trim() || 'Scheduled Commitment',
                  priority: 'high',
                  estimatedDuration: 60,
                },
                expectedOutput: 'Commitment added to schedule',
                requiresApproval: false,
                retryPolicy: { maxRetries: 1, retryCount: 0 }
              }
            ]
          } as unknown as T;
        }

        return {
          intendedOutcome: 'Analyze and schedule tasks, detect conflicts, and optimize deadline timeline.',
          verificationCriteria: 'Updated task schedule without overlapping high-priority commitments.',
          steps: [
            {
              id: 'step_1',
              title: 'Evaluate existing tasks and schedule timeline',
              worker: 'scheduling',
              tool: 'schedule_manage',
              dependencies: [],
              input: { action: 'analyze_and_reschedule' },
              expectedOutput: 'Optimized schedule with overdue items flagged',
              requiresApproval: false,
              retryPolicy: { maxRetries: 1, retryCount: 0 }
            }
          ]
        } as unknown as T;
      }

      if (q.includes('email') || q.includes('draft') || q.includes('message') || q.includes('reply')) {
        return {
          intendedOutcome: 'Draft a professional email conforming to user tone preferences.',
          verificationCriteria: 'Subject line and body generated without automatic transmission.',
          steps: [
            {
              id: 'step_1',
              title: 'Draft email message',
              worker: 'email',
              tool: 'email_draft',
              dependencies: [],
              input: { context: userReq, recipient: 'Team' },
              expectedOutput: 'Draft email subject and body',
              requiresApproval: false,
              retryPolicy: { maxRetries: 1, retryCount: 0 }
            }
          ]
        } as unknown as T;
      }

      // Default fallback for general or conversational directives: generate a concise document brief
      return {
        intendedOutcome: `Fulfill directive: "${userReq}"`,
        verificationCriteria: 'Deliverable produced for the user.',
        steps: [
          {
            id: 'step_1',
            title: `Execute request: ${userReq.slice(0, 50)}`,
            worker: 'document',
            tool: 'document_create',
            dependencies: [],
            input: {
              title: `Directive Summary: ${userReq.slice(0, 30) || 'Action Result'}`,
              type: 'summary'
            },
            expectedOutput: 'Response synthesized for directive',
            requiresApproval: false,
            retryPolicy: { maxRetries: 1, retryCount: 0 }
          }
        ]
      } as unknown as T;
    }

    // Memory extraction requests
    if (p.includes('memory') || p.includes('extract candidate')) {
      const observations: any[] = [];
      if (p.includes('concise') || p.includes('brief') || p.includes('table')) {
        observations.push({
          candidateContent: 'User prefers concise technical documents with structured tables.',
          category: 'preference',
          suggestedType: 'explicit',
          confidence: 0.95,
          rationale: 'User explicitly stated formatting and conciseness preference in the request.'
        });
      }
      return observations as unknown as T;
    }

    if (fallbackGenerator) {
      return fallbackGenerator();
    }
    throw new Error('Could not generate structured response for the prompt');
  }
}

// 2. Groq Gemma Provider (Fast open-weight inference)
export class GroqGemmaProvider implements ModelProvider {
  name = 'Gemma-2-9b-it (via Groq Cloud)';
  isMock = false;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemma2-9b-it') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateText(prompt: string, options?: ModelCompletionOptions): Promise<string> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens ?? 2048,
        response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async generateStructured<T>(prompt: string, schemaDescription: string, fallbackGenerator?: () => T): Promise<T> {
    const fullPrompt = `${prompt}\n\nYou MUST respond strictly with valid JSON conforming to this schema:\n${schemaDescription}\nDo not wrap with markdown backticks or commentary.`;
    try {
      const text = await this.generateText(fullPrompt, { jsonMode: true, temperature: 0.1 });
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err) {
      if (fallbackGenerator) return fallbackGenerator();
      throw err;
    }
  }
}

// 3. Hugging Face Inference Gemma Provider
export class HuggingFaceGemmaProvider implements ModelProvider {
  name = 'Gemma-2-9b-it (via Hugging Face)';
  isMock = false;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'google/gemma-2-9b-it') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateText(prompt: string, options?: ModelCompletionOptions): Promise<string> {
    const res = await fetch(`https://api-inference.huggingface.co/models/${this.model}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: options?.maxTokens ?? 1500,
          temperature: options?.temperature ?? 0.2,
          return_full_text: false,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Hugging Face API error (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    if (Array.isArray(data) && data[0]?.generated_text) {
      return data[0].generated_text;
    }
    return JSON.stringify(data);
  }

  async generateStructured<T>(prompt: string, schemaDescription: string, fallbackGenerator?: () => T): Promise<T> {
    const fullPrompt = `${prompt}\n\nRespond ONLY with valid JSON conforming to schema:\n${schemaDescription}`;
    try {
      const text = await this.generateText(fullPrompt);
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err) {
      if (fallbackGenerator) return fallbackGenerator();
      throw err;
    }
  }
}

// 4. Google Gemini Provider (Google AI Studio)
export class GoogleGeminiProvider implements ModelProvider {
  name = 'Gemini 1.5 Flash (Google AI Studio)';
  isMock = false;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-1.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateText(prompt: string, options?: ModelCompletionOptions): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const payload: any = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature ?? 0.2,
        maxOutputTokens: options?.maxTokens ?? 2048,
      },
    };
    if (options?.jsonMode) {
      payload.generationConfig.responseMimeType = 'application/json';
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Gemini API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async generateStructured<T>(prompt: string, schemaDescription: string, fallbackGenerator?: () => T): Promise<T> {
    const fullPrompt = `${prompt}\n\nYou MUST respond strictly with valid JSON conforming to this schema:\n${schemaDescription}\nDo not wrap with markdown backticks or commentary.`;
    try {
      const text = await this.generateText(fullPrompt, { jsonMode: true, temperature: 0.1 });
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err) {
      if (fallbackGenerator) return fallbackGenerator();
      throw err;
    }
  }
}

// 5. Local Ollama Provider (100% on-device private open-weight inference)
export class OllamaGemmaProvider implements ModelProvider {
  name = 'Gemma (Local On-Device Ollama)';
  isMock = false;
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'gemma3:4b') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
  }

  async generateText(prompt: string, options?: ModelCompletionOptions): Promise<string> {
    const payload: any = {
      model: this.model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.2,
        num_predict: options?.maxTokens ?? 2048,
      },
    };
    if (options?.jsonMode) {
      payload.format = 'json';
    }

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Local Ollama error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.response || '';
  }

  async generateStructured<T>(prompt: string, schemaDescription: string, fallbackGenerator?: () => T): Promise<T> {
    const fullPrompt = `${prompt}\n\nYou MUST respond strictly with valid JSON conforming to this schema:\n${schemaDescription}\nDo not wrap with markdown backticks or commentary.`;
    try {
      const text = await this.generateText(fullPrompt, { jsonMode: true, temperature: 0.1 });
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err) {
      if (fallbackGenerator) return fallbackGenerator();
      throw err;
    }
  }
}

export function getGemmaProvider(): ModelProvider {
  const providerType = process.env.GEMMA_PROVIDER?.toLowerCase();

  // Explicit Local Ollama Provider (Runs on device)
  if (providerType === 'ollama' || providerType === 'local') {
    return new OllamaGemmaProvider(process.env.OLLAMA_BASE_URL || 'http://localhost:11434', process.env.GEMMA_MODEL || 'gemma3:4b');
  }

  // Explicit Google / Gemini provider
  if ((providerType === 'google' || providerType === 'gemini') && (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY)) {
    return new GoogleGeminiProvider(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY!, process.env.GEMMA_MODEL || 'gemini-1.5-flash');
  }

  // Explicit Groq provider
  if (providerType === 'groq' && process.env.GROQ_API_KEY) {
    return new GroqGemmaProvider(process.env.GROQ_API_KEY, process.env.GEMMA_MODEL || 'gemma2-9b-it');
  }

  // Explicit Hugging Face provider
  if (providerType === 'huggingface' && process.env.HUGGINGFACE_API_KEY) {
    return new HuggingFaceGemmaProvider(process.env.HUGGINGFACE_API_KEY, process.env.GEMMA_MODEL || 'google/gemma-2-9b-it');
  }

  // Auto-detect available keys
  if (process.env.GROQ_API_KEY) {
    return new GroqGemmaProvider(process.env.GROQ_API_KEY, process.env.GEMMA_MODEL || 'gemma2-9b-it');
  }

  if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) {
    return new GoogleGeminiProvider(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY!, process.env.GEMMA_MODEL || 'gemini-1.5-flash');
  }

  if (process.env.HUGGINGFACE_API_KEY) {
    return new HuggingFaceGemmaProvider(process.env.HUGGINGFACE_API_KEY, process.env.GEMMA_MODEL || 'google/gemma-2-9b-it');
  }

  // Safe fallback to local development provider with heuristic accuracy
  return new MockGemmaProvider();
}
