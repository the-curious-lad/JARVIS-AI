import { NextRequest, NextResponse } from 'next/server';
import { copilotOrchestrator } from '@/lib/copilot/orchestrator';
import { contextEngine } from '@/lib/memory/contextEngine';
import { tracer } from '@/lib/observability/sentry';
import { synthesizeSpeech } from '@/lib/voice/elevenlabs';
import { promptRewriter } from '@/lib/ai/promptRewriter';
import { chatStore } from '@/lib/chat/chatStore';
import { getGemmaProvider } from '@/lib/ai/gemma';
import { userStore } from '@/lib/auth/userStore';

export async function POST(req: NextRequest) {
  const start = Date.now();
  const traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    const body = await req.json();
    const cookieUserId = req.cookies.get('jarvis_user_id')?.value;
    const userId = body.userId || cookieUserId || 'default_user';
    const { message, voiceMode = false, conversationId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Save user message to chat store if conversationId provided
    let activeConvId = conversationId;
    if (activeConvId) {
      await chatStore.addMessage({
        conversationId: activeConvId,
        userId,
        role: 'user',
        content: message,
      });
    }

    // Retrieve user callsign and tone preferences
    const userProfile = await userStore.getUserById(userId);
    const callsign = userProfile?.callsign || 'Sir';

    // Conversational & Greeting Fast-Path (Instant sub-50ms natural response)
    const trimmedMsg = message.trim();
    const isGreeting = /^(?:hello|hi|hey|good\s+(?:morning|afternoon|evening)|howdy|greetings|jarvis|hey\s+jarvis|ok\s+jarvis)[\s!.,?]*$/i.test(trimmedMsg);
    const isConversationalQuestion = /^(?:how\s+are\s+you|who\s+are\s+you|what\s+can\s+you\s+do|help|what\s+are\s+your\s+capabilities)[\s!.,?]*$/i.test(trimmedMsg);

    if (isGreeting || isConversationalQuestion) {
      let reply = '';
      if (isGreeting) {
        reply = `Hello, ${callsign}. J.A.R.V.I.S. is fully online and standing by. All systems, vector memory, and research tools are operational. How may I assist you today?`;
      } else if (/who\s+are\s+you/i.test(trimmedMsg)) {
        reply = `I am J.A.R.V.I.S., your autonomous personal AI assistant powered by Google DeepMind's open-weight Gemma architecture and MongoDB Atlas.`;
      } else if (/how\s+are\s+you/i.test(trimmedMsg)) {
        reply = `All systems are operating at peak efficiency, ${callsign}. Core reactor is stable, and I am ready for your directives.`;
      } else {
        reply = `I can perform live web research via SerpApi, compile Word reports, manage your schedule with conflict resolution, and store persistent memories in MongoDB Atlas. How can I help?`;
      }

      let audioBase64: string | undefined = undefined;
      let voiceIsFallback = true;
      if (voiceMode && reply) {
        try {
          const voiceRes = await synthesizeSpeech(reply);
          voiceIsFallback = voiceRes.isFallback;
          if (voiceRes.audioBuffer) {
            audioBase64 = voiceRes.audioBuffer.toString('base64');
          }
        } catch (err) {
          console.warn('Voice synthesis error for greeting:', err);
        }
      }

      if (activeConvId) {
        await chatStore.addMessage({
          conversationId: activeConvId,
          userId,
          role: 'assistant',
          content: reply,
        });
      }

      return NextResponse.json({
        traceId,
        plan: null,
        tasks: [],
        memories: [],
        isCompleted: true,
        hasPendingApproval: false,
        spokenSummary: reply,
        audioBase64,
        voiceIsFallback,
        intentSummary: 'Conversational Greeting',
        keywords: ['greeting', 'conversation'],
        conversationId: activeConvId,
        durationMs: Date.now() - start,
      });
    }

    // =========================================================================
    // DUAL-TRACK PARALLEL CONVERGENCE PIPELINE
    // Track A: Copilot structural DAG planning
    // Track B: Prompt Rewriting & MongoDB Atlas Vector Search retrieval
    // Both executed concurrently in parallel via Promise.all!
    // =========================================================================
    const parallelStart = Date.now();

    const [plan, personalizationContext] = await Promise.all([
      // Track A
      copilotOrchestrator.createPlan(userId, message),

      // Track B
      (async () => {
        const rewritten = await promptRewriter.rewritePromptAndExtractKeywords(message);
        const relevant = await contextEngine.getRelevantContext(userId, rewritten.semanticSearchQuery);
        return {
          rewritten,
          relevant,
        };
      })(),
    ]);

    const parallelDuration = Date.now() - parallelStart;

    await tracer.recordSpan({
      traceId,
      planId: plan.id,
      spanName: 'copilot.dual_track_parallel_planning',
      startTime: parallelStart,
      endTime: Date.now(),
      durationMs: parallelDuration,
      status: 'ok',
      tags: {
        userId,
        stepsCount: plan.steps.length,
        retrievedMemoriesCount: personalizationContext.relevant.memories.length,
        keywords: personalizationContext.rewritten.keywords.join(', '),
      },
    });

    // Execute plan through persistent Action Queue
    const execStart = Date.now();
    const execResult = await copilotOrchestrator.executePlan(plan.id, userId);
    const execDuration = Date.now() - execStart;

    await tracer.recordSpan({
      traceId,
      planId: plan.id,
      spanName: 'copilot.execute_plan',
      startTime: execStart,
      endTime: Date.now(),
      durationMs: execDuration,
      status: 'ok',
      tags: {
        userId,
        isCompleted: execResult.isCompleted,
        hasPendingApproval: execResult.hasPendingApproval,
      },
    });

    // Retrieve active memories for context display
    const memories = await contextEngine.getAllMemories(userId);

    const preferredTone = userProfile?.preferredTone || 'Concise and helpful spoken responses';

    // Vocal synthesis via ElevenLabs & Conversational Gemma Generation
    let spokenSummary = '';
    let audioBase64: string | undefined = undefined;
    let voiceIsFallback = true;

    if (execResult.isCompleted) {
      // Formulate natural conversational response via Gemma
      const gemma = getGemmaProvider();
      const conversationalPrompt = `You are J.A.R.V.I.S., an advanced autonomous AI assistant addressing the user as "${callsign}".
User Request: "${message}"
Execution Outcome: ${execResult.plan.intendedOutcome}
Execution Details: ${JSON.stringify(execResult.plan.finalResult || [])}
User Preference Tone: "${preferredTone}"

Generate a concise, natural, spoken response answering the user directly in character as JARVIS.
Do NOT say robotic meta-statements like "Task completed, Sir" or "Fulfill directive".
If the user asked about their schedule or tasks and there are no tasks, explicitly inform them that their schedule is completely clear for today.
If the user expressed gratitude (e.g. "thank you"), acknowledge politely.
Keep the response spoken, polite, and to the point (1-3 sentences max).`;

      try {
        spokenSummary = await gemma.generateText(conversationalPrompt);
        spokenSummary = spokenSummary.replace(/^["']|["']$/g, '').trim();
      } catch (err) {
        console.warn('Gemma conversational response fallback:', err);
        spokenSummary = `Directive acknowledged, ${callsign}. All steps have been verified.`;
      }
    } else if (execResult.hasPendingApproval) {
      spokenSummary = `Directive paused, ${callsign}. Authorization is required before proceeding with this action.`;
    } else if (execResult.plan.status === 'failed') {
      spokenSummary = `I encountered an issue executing that directive, ${callsign}. Would you like me to adjust the plan and try an alternative approach?`;
    } else {
      spokenSummary = `Executing directive now, ${callsign}.`;
    }

    if (voiceMode && spokenSummary) {
      try {
        const voiceRes = await synthesizeSpeech(spokenSummary);
        voiceIsFallback = voiceRes.isFallback;
        if (voiceRes.audioBuffer) {
          audioBase64 = voiceRes.audioBuffer.toString('base64');
        }
      } catch (err) {
        console.warn('Voice synthesis error:', err);
      }
    }

    // Save assistant response message to chat store
    if (activeConvId) {
      await chatStore.addMessage({
        conversationId: activeConvId,
        userId,
        role: 'assistant',
        content: spokenSummary,
      });
    }

    return NextResponse.json({
      traceId,
      plan: execResult.plan,
      tasks: execResult.tasks,
      memories,
      isCompleted: execResult.isCompleted,
      hasPendingApproval: execResult.hasPendingApproval,
      spokenSummary,
      audioBase64,
      voiceIsFallback,
      intentSummary: personalizationContext.rewritten.intentSummary,
      keywords: personalizationContext.rewritten.keywords,
      conversationId: activeConvId,
      durationMs: Date.now() - start,
    });
  } catch (err: any) {
    console.error('Chat endpoint error:', err);
    await tracer.recordSpan({
      traceId,
      spanName: 'copilot.error',
      startTime: start,
      endTime: Date.now(),
      durationMs: Date.now() - start,
      status: 'error',
      tags: { error: err.message },
      errorMessage: err.message,
    });

    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
