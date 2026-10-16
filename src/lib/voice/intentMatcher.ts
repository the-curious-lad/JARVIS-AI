export type VoiceIntentType =
  | 'OPEN_NEW_CHAT'
  | 'SHOW_CHAT_ARCHIVES'
  | 'CLOSE_CHAT'
  | 'SHOW_SCHEDULE'
  | 'SHOW_MEMORY'
  | 'SYSTEM_STATUS'
  | 'CLEAR_SCREEN'
  | 'WAKE_GREETING'
  | 'AI_DIRECTIVE';

export interface ParsedVoiceCommand {
  hasWakeWord: boolean;
  cleanText: string;
  commandText: string;
  intent: VoiceIntentType;
  spokenFeedback: (callsign: string) => string;
}

// Regex to detect wake words ("Hey Jarvis", "OK Jarvis", "Jarvis", "Hello Jarvis", etc.) anywhere in utterance
const WAKE_WORD_PATTERN = /(?:^|.*?)(?:hey|ok|hello|hi)?\s*jarvis[\s,:]*(.*)$/i;

// Regex patterns for local UI intents and conversational fast-paths
const INTENT_PATTERNS: { type: VoiceIntentType; pattern: RegExp; feedback: (c: string) => string }[] = [
  {
    type: 'WAKE_GREETING',
    pattern: /^(?:hello|hi|hey|good\s+(?:morning|afternoon|evening)|howdy|greetings)[\s!.,?]*$/i,
    feedback: (callsign) => `Hello, ${callsign}. J.A.R.V.I.S. is fully online and standing by. How may I assist you today?`,
  },
  {
    type: 'WAKE_GREETING',
    pattern: /^(?:how\s+are\s+you|how's\s+it\s+going|are\s+you\s+(?:there|online|ready))[\s!.,?]*$/i,
    feedback: (callsign) => `All systems are operating at peak efficiency, ${callsign}. Core reactor is stable, and I am ready for your directives.`,
  },
  {
    type: 'WAKE_GREETING',
    pattern: /^(?:who\s+are\s+you|what\s+is\s+your\s+name|introduce\s+yourself)[\s!.,?]*$/i,
    feedback: (callsign) => `I am J.A.R.V.I.S., your autonomous personal assistant powered by Google DeepMind's Gemma open-weight model and MongoDB Atlas.`,
  },
  {
    type: 'WAKE_GREETING',
    pattern: /^(?:what\s+can\s+you\s+do|help|capabilities|features)[\s!.,?]*$/i,
    feedback: (callsign) => `I can perform live web research via SerpApi, compile Word reports, manage your schedule with conflict resolution, and store persistent memories in MongoDB Atlas.`,
  },
  {
    type: 'OPEN_NEW_CHAT',
    pattern: /(?:open|start|create|begin)\s+(?:a\s+)?new\s+(?:chat|session|conversation|directive)|^(?:new\s+chat)$|^(?:fresh\s+session)$/i,
    feedback: (callsign) => `Opening a new session now, ${callsign}. Ready for your directives.`,
  },
  {
    type: 'SHOW_CHAT_ARCHIVES',
    pattern: /(?:show|view|open|access|display|list)\s+(?:the\s+|my\s+|recent\s+|all\s+)?(?:chats?|archives|conversations?|history|drawer|panel)|^(?:open\s+chat)$|^(?:chats?)$/i,
    feedback: (callsign) => `Opening chat archives, ${callsign}.`,
  },
  {
    type: 'CLOSE_CHAT',
    pattern: /(?:close|hide|exit|dismiss)\s+(?:the\s+)?(?:chat|panel|drawer|archives)/i,
    feedback: (callsign) => `Closing chat panel, ${callsign}.`,
  },
  {
    type: 'SHOW_SCHEDULE',
    pattern: /(?:show|view|open|display|check|what(?:'s| is)\s+on|do\s+i\s+have\s+any)\s+(?:the\s+|my\s+|any\s+)?(?:tasks?|events?|schedule|calendar|agenda|commitments?|works?|focus\s+blocks?)|(?:any\s+tasks?\s+(?:for|scheduled\s+for)\s+today)/i,
    feedback: (callsign) => `Checking your schedule, ${callsign}.`,
  },
  {
    type: 'SHOW_MEMORY',
    pattern: /(?:show|view|open|access)\s+(?:my\s+)?(?:memories|memory|personal\s+context|profile|preferences)/i,
    feedback: (callsign) => `Accessing your Personal Context Engine, ${callsign}.`,
  },
  {
    type: 'SYSTEM_STATUS',
    pattern: /(?:system\s+status|status\s+report|run\s+diagnostics|system\s+health|telemetry)/i,
    feedback: (callsign) => `All systems nominal, ${callsign}. Core reactor is stable. Vector engine armed.`,
  },
  {
    type: 'CLEAR_SCREEN',
    pattern: /(?:clear|clean|reset)\s+(?:the\s+)?(?:screen|display|deck|hud|terminal)/i,
    feedback: (callsign) => `Screen cleared, ${callsign}.`,
  },
];

/**
 * Parses spoken or written input, checks for wake-word presence,
 * and classifies the intent into either a fast UI command or an AI directive.
 */
export function parseVoiceDirective(rawText: string): ParsedVoiceCommand {
  const cleanText = (rawText || '').trim();
  if (!cleanText) {
    return {
      hasWakeWord: false,
      cleanText: '',
      commandText: '',
      intent: 'AI_DIRECTIVE',
      spokenFeedback: (callsign) => `I am listening, ${callsign}.`,
    };
  }

  let hasWakeWord = false;
  let commandText = cleanText;

  const wakeMatch = cleanText.match(WAKE_WORD_PATTERN);
  if (wakeMatch) {
    hasWakeWord = true;
    commandText = (wakeMatch[1] || '').trim();
  }

  // If the user only said "Jarvis" or "Hey Jarvis" with nothing else
  if (hasWakeWord && (!commandText || /^[\s,.:;!?-]*$/.test(commandText))) {
    return {
      hasWakeWord: true,
      cleanText,
      commandText: '',
      intent: 'WAKE_GREETING',
      spokenFeedback: (callsign) => `At your service, ${callsign}. How may I assist you?`,
    };
  }

  // Check matching intent on the command portion (or whole text if no wake word)
  const targetToMatch = commandText || cleanText;

  for (const item of INTENT_PATTERNS) {
    if (item.pattern.test(targetToMatch)) {
      return {
        hasWakeWord,
        cleanText,
        commandText: targetToMatch,
        intent: item.type,
        spokenFeedback: item.feedback,
      };
    }
  }

  // Fallback to AI Directive
  return {
    hasWakeWord,
    cleanText,
    commandText: targetToMatch,
    intent: 'AI_DIRECTIVE',
    spokenFeedback: (callsign) => `Processing directive, ${callsign}.`,
  };
}
