import { describe, it, expect } from 'vitest';
import { parseVoiceDirective } from '@/lib/voice/intentMatcher';
import { getGemmaProvider } from '@/lib/ai/gemma';

describe('Voice Intent Matcher & Wake-Word Parser', () => {
  it('should detect wake word "Hey Jarvis" and extract command', () => {
    const result = parseVoiceDirective('Hey Jarvis, open a new chat');
    expect(result.hasWakeWord).toBe(true);
    expect(result.intent).toBe('OPEN_NEW_CHAT');
    expect(result.commandText).toBe('open a new chat');
  });

  it('should detect wake word "Jarvis" without prefix', () => {
    const result = parseVoiceDirective('Jarvis, show my schedule');
    expect(result.hasWakeWord).toBe(true);
    expect(result.intent).toBe('SHOW_SCHEDULE');
    expect(result.commandText).toBe('show my schedule');
  });

  it('should handle wake greeting when only wake word is spoken', () => {
    const result = parseVoiceDirective('Hey Jarvis');
    expect(result.hasWakeWord).toBe(true);
    expect(result.intent).toBe('WAKE_GREETING');
    expect(result.spokenFeedback('Master')).toContain('At your service, Master');
  });

  it('should match intent without wake word (typed or direct voice command)', () => {
    const r1 = parseVoiceDirective('open a new chat');
    expect(r1.intent).toBe('OPEN_NEW_CHAT');

    const r2 = parseVoiceDirective('start a new session');
    expect(r2.intent).toBe('OPEN_NEW_CHAT');

    const r3 = parseVoiceDirective('show my schedule');
    expect(r3.intent).toBe('SHOW_SCHEDULE');

    const r4 = parseVoiceDirective('system status report');
    expect(r4.intent).toBe('SYSTEM_STATUS');

    const r5 = parseVoiceDirective('clear the screen');
    expect(r5.intent).toBe('CLEAR_SCREEN');

    const r6 = parseVoiceDirective('show personal context');
    expect(r6.intent).toBe('SHOW_MEMORY');

    const r7 = parseVoiceDirective('do I have any tasks scheduled for today');
    expect(r7.intent).toBe('SHOW_SCHEDULE');
  });

  it('should classify complex tasks as AI_DIRECTIVE', () => {
    const result = parseVoiceDirective('Hey Jarvis, conduct comprehensive research on neural memory networks');
    expect(result.hasWakeWord).toBe(true);
    expect(result.intent).toBe('AI_DIRECTIVE');
    expect(result.commandText).toContain('conduct comprehensive research');
  });
});

describe('Planner Fallback Heuristic Isolation', () => {
  const gemma = getGemmaProvider();

  it('should NOT generate research reports for non-research directives', async () => {
    const prompt = `You are Jarvis Copilot.
User Request: "What is your operating frequency?"
User Context & Preferences:
Primary areas of technical interest: "Open-Weight AI & Autonomous Systems".
Available Registered Tools:
[
  { "name": "research_search", "description": "Conduct live web research" },
  { "name": "document_create", "description": "Create document" }
]`;

    const plan = await gemma.generateStructured<any>(prompt, 'Plan JSON');
    expect(plan.steps).toBeDefined();
    expect(plan.steps.length).toBeGreaterThan(0);
    // Should NOT have run research_search with open-weight models query
    const searchStep = plan.steps.find((s: any) => s.tool === 'research_search');
    expect(searchStep).toBeUndefined();
  });

  it('should generate research plan when user explicitly asks for research', async () => {
    const prompt = `You are Jarvis Copilot.
User Request: "Research latest benchmarks for open-weight models"
User Context & Preferences:
Tone: Concise
Available Registered Tools:
[
  { "name": "research_search", "description": "Conduct live web research" }
]`;

    const plan = await gemma.generateStructured<any>(prompt, 'Plan JSON');
    expect(plan.steps).toBeDefined();
    const searchStep = plan.steps.find((s: any) => s.tool === 'research_search');
    expect(searchStep).toBeDefined();
  });

  it('should plan schedule create action when user asks to schedule an interview', async () => {
    const prompt = `You are Jarvis Copilot.
User Request: "Okay can you please schedule an interview for 9:00 p.m. today"
Available Registered Tools:
[
  { "name": "schedule_manage", "description": "Manage tasks and calendar" }
]`;

    const plan = await gemma.generateStructured<any>(prompt, 'Plan JSON');
    expect(plan.steps).toBeDefined();
    expect(plan.steps[0].tool).toBe('schedule_manage');
    expect(plan.steps[0].input.action).toBe('create');
  });

  it('should confirm scheduling commitment in spoken response', async () => {
    const prompt = `You are J.A.R.V.I.S., addressing the user as "Master".
User Request: "Okay can you please schedule an interview for 9:00 p.m. today"
Execution Outcome: Schedule commitment: "Okay can you please schedule an interview for 9:00 p.m. today"
User Preference Tone: "Concise"`;

    const response = await gemma.generateText(prompt);
    expect(response.toLowerCase()).toContain('scheduled');
    expect(response.toLowerCase()).not.toContain('your calendar is completely clear');
  });
});
