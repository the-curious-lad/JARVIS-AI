'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Brain,
  Calendar,
  Clock,
  Copy,
  Download,
  FileText,
  ListTodo,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Volume2,
  AlertTriangle,
  ExternalLink,
  Activity,
  Plus,
  MessageSquare,
  X,
  ChevronRight,
  ShieldCheck,
  User,
  LogOut,
  Edit2,
  Radio,
} from 'lucide-react';
import { Plan, Task, Memory, ScheduledTask, GeneratedDocument } from '@/types';
import { ChatConversation, ChatMessage } from '@/lib/chat/chatStore';
import { parseVoiceDirective } from '@/lib/voice/intentMatcher';

type ActiveTab = 'assistant' | 'queue' | 'scheduler' | 'memory' | 'documents' | 'traces' | 'settings';

export default function JarvisDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('assistant');
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [spokenTextHUD, setSpokenTextHUD] = useState<string>('');

  // User Authentication State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authCallsign, setAuthCallsign] = useState('Sir');
  const [authTone, setAuthTone] = useState('Concise technical documents with structured tables');
  const [authFocus, setAuthFocus] = useState('Open-Weight AI & Autonomous Systems');
  const [authError, setAuthError] = useState('');

  // Multi-Chat Drawer State
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  activeConversationIdRef.current = activeConversationId;
  const latestSpokenTranscriptRef = useRef<string>('');
  const [activeChatMessages, setActiveChatMessages] = useState<ChatMessage[]>([]);
  const [showPlanDetails, setShowPlanDetails] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Core Data State
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [currentTasks, setCurrentTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [scheduleAnalysis, setScheduleAnalysis] = useState<any>(null);
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [traces, setTraces] = useState<any[]>([]);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [activeDoc, setActiveDoc] = useState<GeneratedDocument | null>(null);

  // Scheduler Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [newTaskDuration, setNewTaskDuration] = useState(60);
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTime, setEditTaskTime] = useState('');

  // Memory Form State
  const [newMemoryContent, setNewMemoryContent] = useState('');

  // Speech recognition & audio player ref
  const recognitionRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Real Hardware Audio Meter & Voice Comm State
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [audioMeterLevels, setAudioMeterLevels] = useState<number[]>([15, 12, 18, 14, 20, 16, 14, 18, 12, 15]);
  const [voiceCommActive, setVoiceCommActive] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);

  // Continuous Wake-Word & Push-to-Talk State
  const [wakeWordMode, setWakeWordMode] = useState(true);
  const [wakeWordActive, setWakeWordActive] = useState(false);
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeListeningUntilRef = useRef<number>(0);
  const wakeWordModeRef = useRef(wakeWordMode);
  wakeWordModeRef.current = wakeWordMode;
  const voiceCommActiveRef = useRef(voiceCommActive);
  voiceCommActiveRef.current = voiceCommActive;
  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;
  const isPushToTalkRef = useRef(isPushToTalk);
  isPushToTalkRef.current = isPushToTalk;

  // Resilient Speech-to-Text & Dispatch Tracking Refs
  const pendingDispatchRef = useRef<boolean>(false);
  const pendingDispatchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechFallbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const meterIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inputMessageRef = useRef<string>('');
  inputMessageRef.current = inputMessage;
  const spokenTextHUDRef = useRef<string>('');
  spokenTextHUDRef.current = spokenTextHUD;

  // Immediate speech cancellation so user input is never blocked by assistant audio
  const forceStopSpeaking = () => {
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch {}
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  };

  useEffect(() => {
    checkCurrentUser();
    loadInitialData();

    return () => {
      stopHardwareAudioMeter();
    };
  }, []);

  // Push-to-Talk: Spacebar press starts speech engine; release dispatches without dropping trailing words
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
        return;
      }

      if (e.code === 'Space' && !e.repeat && !isPushToTalkRef.current) {
        e.preventDefault();
        setIsPushToTalk(true);
        isPushToTalkRef.current = true;
        setIsRecording(true);
        setVoiceCommActive(true);
        setMicError(null);
        latestSpokenTranscriptRef.current = '';
        setInputMessage('');
        setSpokenTextHUD('');

        // Cleanly reset any audio playing so user voice is completely uninhibited
        forceStopSpeaking();

        startVisualMeter();
        startSpeechEngine();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
        return;
      }

      if (e.code === 'Space' && isPushToTalkRef.current) {
        e.preventDefault();
        finishAndDispatchVoice();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatMessages]);

  const checkCurrentUser = async () => {
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('jarvis_user_profile');
        if (cached) {
          try {
            const u = JSON.parse(cached);
            if (u?.id) {
              setCurrentUser(u);
              setShowAuthModal(false);
            }
          } catch {}
        }
      }

      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data?.user) {
        setCurrentUser(data.user);
        if (typeof window !== 'undefined') {
          localStorage.setItem('jarvis_user_profile', JSON.stringify(data.user));
        }
        setShowAuthModal(false);
      } else {
        const hasCached = typeof window !== 'undefined' && localStorage.getItem('jarvis_user_profile');
        if (!hasCached) {
          setShowAuthModal(true);
        }
      }
    } catch {
      const hasCached = typeof window !== 'undefined' && localStorage.getItem('jarvis_user_profile');
      if (!hasCached) {
        setShowAuthModal(true);
      }
    }
  };

  const loadInitialData = async () => {
    try {
      const [statusRes, tasksRes, memRes, schedRes, docRes, traceRes, convRes] = await Promise.all([
        fetch('/api/status').then((r) => r.json()),
        fetch('/api/tasks').then((r) => r.json()),
        fetch('/api/memory').then((r) => r.json()),
        fetch('/api/schedule').then((r) => r.json()),
        fetch('/api/documents').then((r) => r.json()),
        fetch('/api/traces').then((r) => r.json()),
        fetch('/api/conversations').then((r) => r.json()),
      ]);

      if (statusRes) setSystemStatus(statusRes);
      if (tasksRes?.tasks) setAllTasks(tasksRes.tasks);
      if (memRes?.memories) setMemories(memRes.memories);
      if (schedRes?.tasks) {
        setScheduledTasks(schedRes.tasks);
        setScheduleAnalysis({
          overdueTasks: schedRes.overdueTasks || [],
          conflicts: schedRes.conflicts || [],
          recommendedSchedule: schedRes.recommendedSchedule || [],
        });
      }
      if (docRes?.documents) {
        setDocuments(docRes.documents);
        if (docRes.documents.length > 0) setActiveDoc(docRes.documents[0]);
      }
      if (traceRes?.traces) setTraces(traceRes.traces);
      if (convRes?.conversations) {
        setConversations(convRes.conversations);
        if (convRes.conversations.length > 0 && !activeConversationId) {
          selectConversation(convRes.conversations[0].id);
        }
      }
    } catch (err) {
      console.warn('Data sync error:', err);
    }
  };

  // Resilient Voice Visualizer Meter (Zero microphone driver contention)
  const startVisualMeter = () => {
    stopHardwareAudioMeter();

    // Responsive animated visualizer for instantaneous visual feedback
    meterIntervalRef.current = setInterval(() => {
      const bars = Array.from({ length: 10 }, () => Math.floor(Math.random() * 55) + 25);
      setAudioMeterLevels(bars);
    }, 90);
  };

  const stopHardwareAudioMeter = () => {
    if (meterIntervalRef.current) {
      clearInterval(meterIntervalRef.current);
      meterIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioMeterLevels([12, 12, 12, 12, 12, 12, 12, 12, 12, 12]);
  };

  const startSpeechEngine = () => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setMicError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari, or type in the directive bar.');
        return;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
        setMicError(null);
      };

      recognition.onresult = (event: any) => {
        // Stop any playing speech output so user is not interrupted
        forceStopSpeaking();

        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (item && item[0]?.transcript) {
            transcript += item[0].transcript;
          }
        }

        const activeText = transcript.trim();
        if (!activeText) return;

        latestSpokenTranscriptRef.current = activeText;
        setInputMessage(activeText);
        setSpokenTextHUD(activeText);

        // If user already released spacebar or tapped mic button, dispatch immediately as transcript arrives
        if (pendingDispatchRef.current) {
          pendingDispatchRef.current = false;
          if (pendingDispatchTimerRef.current) clearTimeout(pendingDispatchTimerRef.current);
          handleVoiceAutoDispatch(activeText, true);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition status:', event.error);
        if (event.error === 'no-speech') {
          // Normal brief pause before speaking, do not crash if still recording
          return;
        }

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setMicError('Microphone permission blocked. Click the lock/settings icon in the browser address bar to allow microphone.');
          setIsRecording(false);
          setVoiceCommActive(false);
        } else if (event.error === 'network') {
          setMicError('Browser speech recognition cloud service timed out or was blocked. You can type directly in the bar.');
        } else if (event.error === 'audio-capture') {
          setMicError('No microphone hardware detected or microphone is currently busy in another app.');
        }
      };

      recognition.onend = () => {
        // If user is actively recording, auto-restart through brief speech pauses
        if (voiceCommActiveRef.current) {
          try {
            recognition.start();
            return;
          } catch {
            // fallback
          }
        }

        setIsRecording(false);
        recognitionRef.current = null;

        // If dispatch was pending completion
        if (pendingDispatchRef.current) {
          pendingDispatchRef.current = false;
          const text = (latestSpokenTranscriptRef.current || inputMessageRef.current || spokenTextHUDRef.current || '').trim();
          if (text) {
            handleVoiceAutoDispatch(text, true);
          }
        }
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
        setIsRecording(true);
        setMicError(null);
      } catch (startErr: any) {
        console.warn('Speech engine start warning:', startErr);
      }
    } catch (err: any) {
      console.warn('Speech engine initialization warning:', err);
    }
  };

  const finishAndDispatchVoice = () => {
    setIsPushToTalk(false);
    isPushToTalkRef.current = false;
    setIsRecording(false);
    setVoiceCommActive(false);
    stopHardwareAudioMeter();

    const text = (latestSpokenTranscriptRef.current || inputMessageRef.current || spokenTextHUDRef.current || '').trim();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    if (text) {
      handleVoiceAutoDispatch(text, true);
    } else {
      // Allow 600ms grace window for delayed Chrome onresult before giving up
      pendingDispatchRef.current = true;
      if (pendingDispatchTimerRef.current) clearTimeout(pendingDispatchTimerRef.current);
      pendingDispatchTimerRef.current = setTimeout(() => {
        if (pendingDispatchRef.current) {
          pendingDispatchRef.current = false;
          const delayedText = (latestSpokenTranscriptRef.current || inputMessageRef.current || spokenTextHUDRef.current || '').trim();
          if (delayedText) {
            handleVoiceAutoDispatch(delayedText, true);
          }
        }
      }, 600);
    }
  };

  // Explicit Activation: Starts on-demand session
  const activateVoiceComm = async () => {
    setMicError(null);
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setMicError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    forceStopSpeaking();
    latestSpokenTranscriptRef.current = '';
    setInputMessage('');
    setSpokenTextHUD('');
    setVoiceCommActive(true);
    voiceCommActiveRef.current = true;
    startVisualMeter();
    startSpeechEngine();
  };

  const deactivateVoiceComm = (isFallbackToText: boolean = false) => {
    setVoiceCommActive(false);
    setIsRecording(false);
    setWakeWordActive(false);
    stopHardwareAudioMeter();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    if (isFallbackToText) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 150);
    }
  };

  const toggleVoiceComm = () => {
    if (voiceCommActive || isRecording) {
      finishAndDispatchVoice();
    } else {
      activateVoiceComm();
    }
  };

  // Play ElevenLabs audio with visualizer feedback and echo suppression
  const playVoiceResponse = (audioBase64?: string, textFallback?: string) => {
    if (!voiceEnabled) return;
    setIsSpeaking(true);
    isSpeakingRef.current = true;

    // Safety watchdog: ensure isSpeaking is ALWAYS reset even if audio stalls
    if (speechFallbackTimerRef.current) clearTimeout(speechFallbackTimerRef.current);
    speechFallbackTimerRef.current = setTimeout(() => {
      if (isSpeakingRef.current) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
      }
    }, 20000);

    // Cleanly abort speech recognition while audio is playing to prevent self-echo
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    stopHardwareAudioMeter();

    const onAudioEnd = () => {
      if (speechFallbackTimerRef.current) clearTimeout(speechFallbackTimerRef.current);
      setIsSpeaking(false);
      isSpeakingRef.current = false;
    };

    if (audioBase64) {
      try {
        const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
        audioPlayerRef.current = audio;
        audio.onended = onAudioEnd;
        audio.onerror = onAudioEnd;
        audio.play().catch(onAudioEnd);
      } catch {
        onAudioEnd();
      }
    } else if (textFallback && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(textFallback);
        utterance.onend = onAudioEnd;
        utterance.onerror = onAudioEnd;
        window.speechSynthesis.speak(utterance);
      } catch {
        onAudioEnd();
      }
    } else {
      onAudioEnd();
    }
  };

  // Hands-free Voice Intent Auto-Dispatcher: Executes UI actions or AI directives
  const handleVoiceAutoDispatch = async (rawText: string, isExplicitPTT: boolean = false) => {
    const text = rawText.trim();
    if (!text || loading) return;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setSpokenTextHUD(text);
    setInputMessage('');
    setWakeWordActive(false);

    const callsign = currentUser?.callsign || 'Master';
    const parsed = parseVoiceDirective(text);

    // 1. Wake Greeting only ("Hey Jarvis" / "Jarvis" / "Hello" / etc.)
    if (parsed.intent === 'WAKE_GREETING') {
      setWakeWordActive(true);
      const greetingFeedback = parsed.spokenFeedback(callsign);

      let convId = activeConversationIdRef.current || activeConversationId;
      if (!convId) {
        try {
          const newRes = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser?.id, title: text }),
          });
          const newData = await newRes.json();
          if (newData.conversation) {
            convId = newData.conversation.id;
            activeConversationIdRef.current = convId;
            setActiveConversationId(convId);
            setConversations((prev) => [newData.conversation, ...prev]);
          }
        } catch {}
      }

      if (convId) {
        await fetch(`/api/conversations/${convId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'user', content: text, userId: currentUser?.id }),
        }).catch(() => {});

        await fetch(`/api/conversations/${convId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'assistant', content: greetingFeedback, userId: currentUser?.id }),
        }).catch(() => {});

        await selectConversation(convId);
      }

      playVoiceResponse(undefined, greetingFeedback);
      return;
    }

    // 2. Instant Local UI Navigation intents (<30ms)
    if (parsed.intent === 'OPEN_NEW_CHAT') {
      await handleCreateNewChat();
      setIsChatDrawerOpen(true);
      setCurrentPlan(null);
      setCurrentTasks([]);
      playVoiceResponse(undefined, parsed.spokenFeedback(callsign));
      return;
    }

    if (parsed.intent === 'SHOW_CHAT_ARCHIVES') {
      setIsChatDrawerOpen(true);
      playVoiceResponse(undefined, parsed.spokenFeedback(callsign));
      return;
    }

    if (parsed.intent === 'CLOSE_CHAT') {
      setIsChatDrawerOpen(false);
      playVoiceResponse(undefined, parsed.spokenFeedback(callsign));
      return;
    }

    if (parsed.intent === 'SHOW_SCHEDULE') {
      // Stay on assistant HUD so conversation context is not broken
      const count = scheduledTasks.length;
      const feedback =
        count === 0
          ? `You have no tasks or conflicts scheduled for today, ${callsign}. Your calendar is completely clear.`
          : `You have ${count} active commitment(s) on your schedule today, ${callsign}.`;

      let convId = activeConversationIdRef.current || activeConversationId;
      if (!convId) {
        try {
          const newRes = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser?.id, title: 'Schedule Query' }),
          });
          const newData = await newRes.json();
          if (newData.conversation) {
            convId = newData.conversation.id;
            activeConversationIdRef.current = convId;
            setActiveConversationId(convId);
            setConversations((prev) => [newData.conversation, ...prev]);
          }
        } catch {}
      }

      if (convId) {
        await fetch(`/api/conversations/${convId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'user', content: text, userId: currentUser?.id }),
        }).catch(() => {});

        await fetch(`/api/conversations/${convId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'assistant', content: feedback, userId: currentUser?.id }),
        }).catch(() => {});

        await selectConversation(convId);
      }

      playVoiceResponse(undefined, feedback);
      return;
    }

    if (parsed.intent === 'SHOW_MEMORY') {
      setActiveTab('memory');
      playVoiceResponse(undefined, parsed.spokenFeedback(callsign));
      return;
    }

    if (parsed.intent === 'SYSTEM_STATUS') {
      setActiveTab('settings');
      playVoiceResponse(undefined, parsed.spokenFeedback(callsign));
      return;
    }

    if (parsed.intent === 'CLEAR_SCREEN') {
      setCurrentPlan(null);
      setCurrentTasks([]);
      playVoiceResponse(undefined, parsed.spokenFeedback(callsign));
      return;
    }

    // 3. Autonomous AI Directive (Dual-Track Parallel Copilot + Vector Search)
    const directiveQuery = parsed.commandText || text;
    await executeChatDirective(directiveQuery);
  };

  const executeChatDirective = async (textToSend: string) => {
    setLoading(true);
    try {
      let convId = activeConversationIdRef.current || activeConversationId;
      if (!convId) {
        const newRes = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser?.id }),
        });
        const newData = await newRes.json();
        if (newData.conversation) {
          convId = newData.conversation.id;
          activeConversationIdRef.current = convId;
          setActiveConversationId(convId);
          setConversations((prev) => [newData.conversation, ...prev]);
        }
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          voiceMode: voiceEnabled,
          userId: currentUser?.id,
          conversationId: convId,
        }),
      });

      const data = await res.json();
      if (data.plan) {
        setCurrentPlan(data.plan);
        setCurrentTasks(data.tasks || []);
      }

      // Play vocal response
      playVoiceResponse(data.audioBase64, data.spokenSummary);

      // Refresh data and active messages
      await loadInitialData();
      if (convId) {
        await selectConversation(convId);
      }
    } catch (err) {
      console.error('Execution error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputMessage;
    if (!textToSend.trim() || loading) return;
    await handleVoiceAutoDispatch(textToSend, true);
  };

  const toggleRecording = () => {
    toggleVoiceComm();
  };

  const toggleWakeWordMode = () => {
    const next = !wakeWordMode;
    setWakeWordMode(next);
    wakeWordModeRef.current = next;

    if (next && !voiceCommActive) {
      activateVoiceComm();
    } else if (!next && voiceCommActive) {
      deactivateVoiceComm(false);
    }
  };

  const handleCreateNewChat = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id }),
      });
      const data = await res.json();
      if (data.conversation) {
        setConversations([data.conversation, ...conversations]);
        activeConversationIdRef.current = data.conversation.id;
        selectConversation(data.conversation.id);
      }
    } catch (err) {
      console.error('Create conversation error:', err);
    }
  };

  const selectConversation = async (convId: string) => {
    setActiveConversationId(convId);
    activeConversationIdRef.current = convId;
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      const data = await res.json();
      if (data.messages) {
        setActiveChatMessages(data.messages);
      }
    } catch (err) {
      console.error('Fetch messages error:', err);
    }
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations/${convId}`, { method: 'DELETE' });
      setConversations(conversations.filter((c) => c.id !== convId));
      if (activeConversationId === convId) {
        setActiveConversationId(null);
        activeConversationIdRef.current = null;
        setActiveChatMessages([]);
      }
    } catch (err) {
      console.error('Delete conversation error:', err);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    try {
      const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const body =
        authMode === 'signup'
          ? {
              name: authName,
              email: authEmail,
              password: authPassword,
              callsign: authCallsign,
              preferredTone: authTone,
              focusAreas: authFocus,
            }
          : { email: authEmail, password: authPassword };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setAuthError(data.error || 'Authentication failed');
        return;
      }

      setCurrentUser(data.user);
      if (typeof window !== 'undefined') {
        localStorage.setItem('jarvis_user_profile', JSON.stringify(data.user));
      }
      setShowAuthModal(false);
      await loadInitialData();
    } catch (err: any) {
      setAuthError(err.message || 'Network error');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    if (typeof window !== 'undefined') {
      localStorage.removeItem('jarvis_user_profile');
    }
    setCurrentUser(null);
    setShowAuthModal(true);
  };

  const handleTaskAction = async (taskId: string, action: 'approve' | 'retry' | 'cancel') => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, action, userId: currentUser?.id }),
      });
      const data = await res.json();
      if (data.tasks) setAllTasks(data.tasks);
      await loadInitialData();
    } catch (err) {
      console.error('Task action error:', err);
    }
  };

  const handleCreateScheduledTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          title: newTaskTitle,
          priority: newTaskPriority,
          estimatedDuration: newTaskDuration,
          deadline: newTaskDeadline || undefined,
        }),
      });
      setNewTaskTitle('');
      setNewTaskDeadline('');
      await loadInitialData();
    } catch (err) {
      console.error('Create task error:', err);
    }
  };

  const handleUpdateTaskTime = async (taskId: string) => {
    if (!editTaskTime) return;
    try {
      await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: taskId,
          userId: currentUser?.id,
          scheduledStart: editTaskTime,
        }),
      });
      setEditingTaskId(null);
      setEditTaskTime('');
      await loadInitialData();
    } catch (err) {
      console.error('Update task time error:', err);
    }
  };

  const handleDeleteScheduledTask = async (taskId: string, priority: string) => {
    if (priority === 'urgent' && !confirm('This task is marked URGENT. Are you certain you wish to delete it, Sir?')) {
      return;
    }

    try {
      await fetch(`/api/schedule?id=${taskId}`, { method: 'DELETE' });
      await loadInitialData();
    } catch (err) {
      console.error('Delete scheduled task error:', err);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryContent.trim()) return;

    try {
      await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          content: newMemoryContent,
          category: 'preference',
          type: 'explicit',
          confidence: 1.0,
        }),
      });
      setNewMemoryContent('');
      await loadInitialData();
    } catch (err) {
      console.error('Add memory error:', err);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await fetch(`/api/memory?id=${id}`, { method: 'DELETE' });
      await loadInitialData();
    } catch (err) {
      console.error('Delete memory error:', err);
    }
  };

  const handleWipeMemories = async () => {
    if (!confirm('Warning: Wipe all neural memories from the Personal Context Engine?')) return;
    try {
      await fetch('/api/memory?wipeAll=true', { method: 'DELETE' });
      await loadInitialData();
    } catch (err) {
      console.error('Wipe memories error:', err);
    }
  };

  return (
    <div className="flex h-screen bg-[#04060d] text-slate-100 overflow-hidden font-sans selection:bg-cyan-500 selection:text-black">
      {/* ======================= AUTH MODAL ======================= */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-[#070b14] border border-cyan-500/30 rounded-2xl p-6 shadow-[0_0_50px_rgba(6,182,212,0.15)] space-y-5">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              title="Dismiss and continue"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="text-center space-y-1">
              <div className="h-12 w-12 mx-auto rounded-xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                <Bot className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold tracking-wider text-white">JARVIS PROTOCOL ACCESS</h2>
              <p className="text-xs text-cyan-400/80 uppercase tracking-widest font-mono">
                {authMode === 'signup' ? 'Initialization & Onboarding' : 'Identity Verification'}
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              {authMode === 'signup' && (
                <>
                  <div>
                    <label className="text-[11px] font-mono text-cyan-400">YOUR FULL NAME</label>
                    <input
                      type="text"
                      required
                      placeholder="Tony Stark"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full bg-[#04060d] border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-mono text-cyan-400">CALLSIGN / TITLE</label>
                      <input
                        type="text"
                        placeholder="Sir"
                        value={authCallsign}
                        onChange={(e) => setAuthCallsign(e.target.value)}
                        className="w-full bg-[#04060d] border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-mono text-cyan-400">FOCUS HOURS</label>
                      <input
                        type="text"
                        placeholder="09:00 - 13:00"
                        value={authFocus}
                        onChange={(e) => setAuthFocus(e.target.value)}
                        className="w-full bg-[#04060d] border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-cyan-400">PREFERRED OUTPUT TONE</label>
                    <select
                      value={authTone}
                      onChange={(e) => setAuthTone(e.target.value)}
                      className="w-full bg-[#04060d] border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="Concise technical documents with structured tables">
                        Concise technical reports with structured tables
                      </option>
                      <option value="Executive brief and high-level summaries">
                        Executive brief and high-level summaries
                      </option>
                      <option value="Detailed comprehensive research with citations">
                        Detailed comprehensive research with citations
                      </option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="text-[11px] font-mono text-cyan-400">SECURE EMAIL</label>
                <input
                  type="email"
                  required
                  placeholder="tony@stark.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full bg-[#04060d] border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-cyan-400">SECURITY PASSPHRASE</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full bg-[#04060d] border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)]"
              >
                {authMode === 'signup' ? 'Initialize Protocol' : 'Authenticate'}
              </button>
            </form>

            <div className="text-center pt-2 border-t border-slate-800/80">
              <button
                onClick={() => {
                  setAuthMode(authMode === 'signup' ? 'login' : 'signup');
                  setAuthError('');
                }}
                className="text-xs text-slate-400 hover:text-cyan-400 transition-colors"
              >
                {authMode === 'signup' ? 'Existing operative? Log in' : 'New operative? Initialize onboarding'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= SIDEBAR ======================= */}
      <aside className="w-64 border-r border-cyan-500/20 bg-[#060a14] flex flex-col justify-between p-4 z-20">
        <div className="space-y-6">
          {/* Logo & Callsign */}
          <div className="flex items-center gap-3 px-2">
            <div className="relative h-10 w-10 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Bot className="h-5 w-5 text-cyan-400" />
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-wider text-white">JARVIS</h1>
              <p className="text-[10px] font-mono text-cyan-400 tracking-widest uppercase">MARK-VII PROTOCOL</p>
            </div>
          </div>

          {/* User Badge */}
          {currentUser && (
            <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-white truncate max-w-[120px]">{currentUser.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300">
                  {currentUser.callsign}
                </span>
              </div>
              <button onClick={handleLogout} title="Log out" className="text-slate-500 hover:text-rose-400">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Telemetry Status Card */}
          <div className="rounded-xl bg-[#03060c] border border-cyan-500/20 p-3 space-y-2 text-[11px] font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">REACTOR:</span>
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <ShieldCheck className="h-3 w-3" /> 100% NOMINAL
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">AI CORE:</span>
              <span className="text-cyan-300 font-semibold">Gemma-2-9b</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">SEARCH:</span>
              <span className="text-amber-400 font-semibold">
                {systemStatus?.search?.hasApiKey ? 'SerpApi Live' : 'SerpApi Engine'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">VOICE:</span>
              <span className="text-purple-400 font-semibold">ElevenLabs Turbo</span>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="space-y-1 font-mono text-xs">
            <button
              onClick={() => setActiveTab('assistant')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                activeTab === 'assistant'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>HUD DIRECTIVE</span>
            </button>

            <button
              onClick={() => setIsChatDrawerOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900/50 transition-all border border-transparent hover:border-slate-800"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 text-cyan-400" />
                <span>CHATS DRAWER</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                {conversations.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                activeTab === 'queue'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <ListTodo className="h-4 w-4" />
                <span>ACTION QUEUE</span>
              </div>
              {allTasks.filter((t) => t.status === 'waiting_approval').length > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {allTasks.filter((t) => t.status === 'waiting_approval').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('scheduler')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                activeTab === 'scheduler'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4" />
                <span>SCHEDULER</span>
              </div>
              {scheduleAnalysis?.overdueTasks?.length > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">
                  {scheduleAnalysis.overdueTasks.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('memory')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                activeTab === 'memory'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Brain className="h-4 w-4" />
                <span>CONTEXT ENGINE</span>
              </div>
              <span className="text-[10px] text-slate-500">{memories.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                activeTab === 'documents'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4" />
                <span>DOCUMENTS</span>
              </div>
              <span className="text-[10px] text-slate-500">{documents.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('traces')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                activeTab === 'traces'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>OBSERVABILITY</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                activeTab === 'settings'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>SYSTEM HEALTH</span>
            </button>
          </nav>
        </div>

        {/* Footer controls: Voice Toggle & Continuous Wake-Word */}
        <div className="pt-4 border-t border-slate-900 space-y-2">
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#03060c] border border-cyan-500/20">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
              <Radio className={`h-4 w-4 ${wakeWordMode ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
              <div className="flex flex-col">
                <span className="font-bold">Wake Comm</span>
                <span className="text-[10px] text-slate-500">&quot;Hey Jarvis&quot;</span>
              </div>
            </div>
            <button
              onClick={toggleWakeWordMode}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                wakeWordMode ? 'bg-cyan-500' : 'bg-slate-800'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-slate-950 transition-transform ${
                  wakeWordMode ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#03060c] border border-cyan-500/20">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
              <Volume2 className="h-4 w-4 text-purple-400" />
              <span>ElevenLabs Voice</span>
            </div>
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                voiceEnabled ? 'bg-cyan-500' : 'bg-slate-800'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-slate-950 transition-transform ${
                  voiceEnabled ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </aside>

      {/* ======================= SLIDE-OUT CHAT DRAWER ======================= */}
      {isChatDrawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md h-full bg-[#060a14] border-l border-cyan-500/30 flex flex-col justify-between p-5 space-y-4 shadow-[0_0_50px_rgba(6,182,212,0.2)]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-cyan-400" />
                <h3 className="font-bold text-sm tracking-wide text-white">DIRECTIVE ARCHIVES</h3>
              </div>
              <button
                onClick={() => setIsChatDrawerOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <button
                onClick={() => {
                  handleCreateNewChat();
                  setIsChatDrawerOpen(false);
                }}
                className="w-full py-2.5 px-3 rounded-xl border border-dashed border-cyan-500/40 hover:bg-cyan-500/10 text-cyan-400 text-xs font-mono flex items-center justify-center gap-2 transition-all"
              >
                <Plus className="h-4 w-4" /> START NEW DIRECTIVE
              </button>

              {conversations.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 font-mono">
                  No directive archives stored yet.
                </div>
              ) : (
                conversations.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      selectConversation(c.id);
                      setIsChatDrawerOpen(false);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer text-xs transition-all flex items-center justify-between ${
                      activeConversationId === c.id
                        ? 'bg-cyan-500/10 border-cyan-500/50 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                        : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="truncate max-w-[280px]">
                      <div className="font-semibold truncate">{c.title}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {new Date(c.updatedAt).toLocaleTimeString()} &bull; {c.messageCount} msgs
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(c.id, e)}
                      className="p-1 hover:text-rose-400 text-slate-600 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================= MAIN HUD CONTENT ======================= */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-[#04060d]">
        {/* ===================== TAB 1: ASSISTANT HUD ===================== */}
        {activeTab === 'assistant' && (
          <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-6 space-y-6">
            {/* Holographic Header */}
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Good day, {currentUser?.callsign || 'Sir'}.</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    VOICE-FIRST OS
                  </span>
                </h2>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  Autonomous Gemma Copilot with SerpApi Google search, ElevenLabs speech synthesis, and Atlas Vector Search.
                </p>
              </div>

              {/* Reactor Telemetry Pill */}
              <div className="flex items-center gap-3">
                <div className="text-right font-mono text-[11px]">
                  <div className="text-cyan-400 font-bold">SYSTEM STATUS</div>
                  <div className="text-slate-500">READY FOR DIRECTIVE</div>
                </div>
                <div className="relative h-9 w-9 rounded-full border border-cyan-500/40 flex items-center justify-center animate-spin-slow shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                  <div className="h-4 w-4 rounded-full bg-cyan-400 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Central Arc-Reactor Holographic Audio Visualizer */}
            <div className="relative rounded-3xl bg-[#060a14] border border-cyan-500/20 p-8 flex flex-col items-center justify-center space-y-4 shadow-[0_0_60px_rgba(6,182,212,0.06)] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent pointer-events-none" />

              {/* Pulsating Concentric Reactor Rings */}
              <div className="relative flex items-center justify-center my-2">
                {/* Outer Ring */}
                <div
                  className={`w-36 h-36 rounded-full border border-cyan-500/30 flex items-center justify-center transition-all duration-500 ${
                    isRecording || isSpeaking ? 'animate-spin-slow scale-110 border-cyan-400' : 'animate-spin-slow'
                  }`}
                >
                  {/* Middle Ring */}
                  <div
                    className={`w-28 h-28 rounded-full border border-dashed border-cyan-400/40 flex items-center justify-center ${
                      isRecording || isSpeaking ? 'animate-spin-reverse-slow border-cyan-300' : 'animate-spin-reverse-slow'
                    }`}
                  >
                    {/* Inner Core */}
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                        isPushToTalk
                          ? 'bg-amber-500/40 border border-amber-400 animate-pulse shadow-[0_0_35px_rgba(245,158,11,0.8)]'
                          : wakeWordActive
                          ? 'bg-cyan-400/50 border-2 border-cyan-300 animate-ping shadow-[0_0_40px_rgba(6,182,212,0.9)]'
                          : isRecording
                          ? 'bg-cyan-500/30 border border-cyan-400 animate-pulse shadow-[0_0_30px_rgba(6,182,212,0.6)]'
                          : isSpeaking
                          ? 'bg-purple-500/40 border border-purple-400 animate-pulse shadow-[0_0_30px_rgba(168,85,247,0.7)]'
                          : 'bg-cyan-500/20 border border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.5)]'
                      }`}
                    >
                      <Bot
                        className={`h-7 w-7 transition-colors ${
                          isPushToTalk
                            ? 'text-amber-300'
                            : wakeWordActive
                            ? 'text-cyan-100'
                            : isRecording
                            ? 'text-cyan-300'
                            : isSpeaking
                            ? 'text-purple-300'
                            : 'text-cyan-400'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Mic Error / Fallback Banner */}
              {micError && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-mono flex items-center justify-between gap-3 max-w-lg w-full">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                    <span>{micError}</span>
                  </div>
                  <button
                    onClick={() => setMicError(null)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Status / Transcription Text Readout */}
              <div className="text-center space-y-1">
                <div className="text-xs font-mono font-bold tracking-widest uppercase">
                  {isPushToTalk ? (
                    <span className="text-amber-400 animate-pulse">Push-To-Talk Active (Spacebar Held) &bull; Speak Directive</span>
                  ) : isRecording ? (
                    <span className="text-cyan-300 animate-pulse">Recording Active (Tap Mic To Send) &bull; Speak Directive</span>
                  ) : isSpeaking ? (
                    <span className="text-purple-400">Streaming Neural Audio Synthesis...</span>
                  ) : loading ? (
                    <span className="text-cyan-400">Dual-Track Execution in Progress...</span>
                  ) : (
                    <span className="text-slate-400">Voice Standby &bull; Hold [Spacebar] to Speak</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-mono max-w-lg">
                  {spokenTextHUD
                    ? `"${spokenTextHUD}"`
                    : isPushToTalk || isRecording
                    ? 'Listening... Speak your directive now'
                    : 'Hold [Spacebar] anytime to talk (release to send) • Or tap the microphone button'}
                </p>
              </div>

              {/* Activation Controls or Live Hardware Audio Meter */}
              {!voiceCommActive && !isPushToTalk && !isRecording ? (
                <div className="flex flex-col items-center gap-2 pt-2">
                  <button
                    onClick={toggleVoiceComm}
                    className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-2 shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all"
                  >
                    <Mic className="h-4 w-4" />
                    <span>TAP TO RECORD DIRECTIVE</span>
                  </button>
                  <span className="text-[11px] font-mono text-slate-500">
                    Click to start speaking &bull; Tap again to transmit &bull; Or hold Spacebar
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 pt-1">
                  <div className="flex items-center gap-1.5 h-8">
                    {audioMeterLevels.map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${h}%` }}
                        className="w-1.5 rounded-full transition-all duration-75 bg-red-400 shadow-[0_0_12px_rgba(239,68,68,0.9)]"
                      />
                    ))}
                  </div>
                  <button
                    onClick={toggleVoiceComm}
                    className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-mono text-xs font-bold animate-pulse flex items-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.7)]"
                  >
                    <Radio className="h-4 w-4" />
                    <span>LISTENING... TAP TO TRANSMIT DIRECTIVE</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Demo Prompts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
              <button
                onClick={() =>
                  handleSendMessage(
                    'Research the best open-weight AI models for my personal assistant. Compare their strengths, hardware requirements, and licensing, and generate a comparison report.'
                  )
                }
                className="text-left p-3.5 rounded-xl bg-[#060a14] border border-cyan-500/20 hover:border-cyan-500/50 hover:bg-cyan-950/20 transition-all group"
              >
                <div className="font-semibold text-cyan-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>E2E Research & DOCX Export</span>
                </div>
                <p className="text-slate-400 text-[11px] mt-1 line-clamp-1">
                  Research best open-weight models via SerpApi & generate Word doc
                </p>
              </button>

              <button
                onClick={() =>
                  handleSendMessage('Remember that I prefer concise technical documents with structured tables.')
                }
                className="text-left p-3.5 rounded-xl bg-[#060a14] border border-cyan-500/20 hover:border-cyan-500/50 hover:bg-cyan-950/20 transition-all group"
              >
                <div className="font-semibold text-purple-400 flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5" />
                  <span>Personal Memory Update</span>
                </div>
                <p className="text-slate-400 text-[11px] mt-1 line-clamp-1">
                  Remember that I prefer concise technical documents with tables
                </p>
              </button>

              <button
                onClick={() =>
                  handleSendMessage('Review my current tasks, identify what is overdue, and propose a revised schedule.')
                }
                className="text-left p-3.5 rounded-xl bg-[#060a14] border border-cyan-500/20 hover:border-cyan-500/50 hover:bg-cyan-950/20 transition-all group"
              >
                <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Deterministic Scheduler</span>
                </div>
                <p className="text-slate-400 text-[11px] mt-1 line-clamp-1">
                  Review tasks, detect mathematical conflicts, and optimize timeline
                </p>
              </button>

              <button
                onClick={() =>
                  handleSendMessage('Draft a professional email update summarizing project progress to the team.')
                }
                className="text-left p-3.5 rounded-xl bg-[#060a14] border border-cyan-500/20 hover:border-cyan-500/50 hover:bg-cyan-950/20 transition-all group"
              >
                <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Email Draft Worker</span>
                </div>
                <p className="text-slate-400 text-[11px] mt-1 line-clamp-1">
                  Draft professional email update adhering to communication preferences
                </p>
              </button>
            </div>

            {/* Input Bar */}
            <div className="relative rounded-2xl bg-[#060a14] border border-cyan-500/30 p-2.5 shadow-[0_0_30px_rgba(6,182,212,0.1)] focus-within:border-cyan-400 transition-all">
              <div className="flex items-center gap-2">
                <input
                  ref={textInputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={
                    micError
                      ? 'Microphone blocked • Type directive here and press Enter...'
                      : isRecording || voiceCommActive
                      ? 'Listening... Speak directive now (tap Mic or press Enter to transmit)'
                      : 'Tap Mic to speak • Or type directive here and press Enter...'
                  }
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none font-mono"
                />

                <button
                  onClick={toggleVoiceComm}
                  type="button"
                  title={isRecording || voiceCommActive ? 'Finish Recording & Transmit' : 'Start Recording Directive'}
                  className={`p-2.5 rounded-xl transition-all ${
                    isRecording || voiceCommActive
                      ? 'bg-red-500 text-white font-bold shadow-[0_0_20px_rgba(239,68,68,0.7)] animate-pulse'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-cyan-400'
                  }`}
                >
                  {isRecording || voiceCommActive ? <Mic className="h-4 w-4 text-white animate-pulse" /> : <MicOff className="h-4 w-4" />}
                </button>

                <button
                  onClick={() => handleSendMessage()}
                  disabled={loading || !inputMessage.trim()}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-40 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                >
                  {loading ? (
                    <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Transmit</span>
                      <Send className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ===================== INLINE ACTIVE CONVERSATION DECK ===================== */}
            <div className="rounded-3xl bg-[#060a14] border border-cyan-500/30 p-5 space-y-4 shadow-[0_0_35px_rgba(6,182,212,0.08)]">
              {/* Dialogue Header */}
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="h-4 w-4 text-cyan-400" />
                  <div>
                    <h3 className="font-bold text-xs tracking-wider text-white uppercase font-mono">
                      DIRECTIVE DIALOGUE STREAM
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {activeConversationId
                        ? conversations.find((c) => c.id === activeConversationId)?.title || 'Active Session'
                        : 'New Session'}{' '}
                      &bull; {activeChatMessages.length} message(s)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {currentPlan && (
                    <button
                      onClick={() => setShowPlanDetails(!showPlanDetails)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/30 hover:border-cyan-400 text-[10px] font-mono text-cyan-300 flex items-center gap-1.5 transition-all"
                    >
                      <Sparkles className="h-3 w-3 text-cyan-400" />
                      <span>Plan Telemetry {showPlanDetails ? '▲' : '▼'}</span>
                    </button>
                  )}

                  <button
                    onClick={handleCreateNewChat}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-[10px] font-mono text-cyan-400 flex items-center gap-1 transition-all"
                    title="Start fresh directive session"
                  >
                    <Plus className="h-3 w-3" />
                    <span>New Chat</span>
                  </button>

                  <button
                    onClick={() => setIsChatDrawerOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-[10px] font-mono text-slate-300 flex items-center gap-1 transition-all"
                    title="View past directive sessions"
                  >
                    <Clock className="h-3 w-3 text-cyan-400" />
                    <span>Archives</span>
                  </button>
                </div>
              </div>

              {/* Dialogue Messages Stream */}
              <div className="max-h-[380px] overflow-y-auto space-y-3 pr-2 font-mono text-xs">
                {activeChatMessages.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 space-y-1">
                    <Bot className="h-8 w-8 mx-auto text-cyan-500/40 animate-pulse" />
                    <p className="text-xs">No directives yet in this session.</p>
                    <p className="text-[11px] text-slate-600">
                      Speak using hands-free, hold [Spacebar], or enter a command above to begin.
                    </p>
                  </div>
                ) : (
                  activeChatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-500 uppercase">
                        {msg.role === 'user' ? (
                          <>
                            <span>{currentUser?.callsign || 'YOU'}</span>
                            <User className="h-3 w-3 text-cyan-400" />
                          </>
                        ) : (
                          <>
                            <Bot className="h-3 w-3 text-purple-400" />
                            <span className="text-cyan-400 font-semibold">J.A.R.V.I.S.</span>
                          </>
                        )}
                        <span>&bull;</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div
                        className={`p-3.5 rounded-2xl max-w-xl text-xs leading-relaxed transition-all ${
                          msg.role === 'user'
                            ? 'bg-cyan-950/40 border border-cyan-500/40 text-cyan-100 rounded-tr-sm shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                            : 'bg-slate-900/80 border border-slate-800 text-slate-200 rounded-tl-sm shadow-[0_0_15px_rgba(15,23,42,0.5)]'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{msg.content}</div>

                        {msg.role === 'assistant' && (
                          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                            <span className="text-[10px] text-cyan-500/60 font-mono">NEURAL VERIFIED</span>
                            <button
                              onClick={() => playVoiceResponse(undefined, msg.content)}
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1 text-[10px]"
                              title="Play spoken response"
                            >
                              <Volume2 className="h-3 w-3" />
                              <span>Replay</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatBottomRef} />
              </div>
            </div>

            {/* Collapsible Current Plan Execution Visualizer */}
            {currentPlan && showPlanDetails && (
              <div className="space-y-4 rounded-2xl bg-[#060a14] border border-cyan-500/30 p-5 shadow-[0_0_30px_rgba(6,182,212,0.08)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono font-bold text-xs border border-cyan-500/40">
                      PLAN
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-white">{currentPlan.intendedOutcome}</h3>
                      <p className="text-xs text-slate-400 font-mono">Directive: &ldquo;{currentPlan.request}&rdquo;</p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-mono font-medium uppercase tracking-wider ${
                      currentPlan.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : currentPlan.status === 'waiting_approval'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    }`}
                  >
                    {currentPlan.status}
                  </span>
                </div>

                {/* Plan Steps */}
                <div className="space-y-2 pt-2">
                  {currentTasks.map((task, idx) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#03060c] border border-slate-800 text-xs font-mono"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-6 w-6 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 font-bold">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-medium text-slate-200">
                            Task: <code className="text-cyan-400">{task.taskType}</code>
                          </div>
                          {task.dependencies?.length > 0 && (
                            <span className="text-[10px] text-slate-500">
                              Depends on: {task.dependencies.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            task.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : task.status === 'waiting_approval'
                              ? 'bg-amber-500/10 text-amber-400'
                              : task.status === 'failed'
                              ? 'bg-rose-500/10 text-rose-400'
                              : 'bg-cyan-500/10 text-cyan-400'
                          }`}
                        >
                          {task.status}
                        </span>

                        {task.status === 'waiting_approval' && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleTaskAction(task.id, 'approve')}
                              className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold hover:bg-amber-400"
                            >
                              Authorize
                            </button>
                            <button
                              onClick={() => handleTaskAction(task.id, 'cancel')}
                              className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                            >
                              Deny
                            </button>
                          </div>
                        )}

                        {task.status === 'failed' && (
                          <button
                            onClick={() => handleTaskAction(task.id, 'retry')}
                            className="px-2.5 py-1 rounded bg-cyan-600 text-slate-950 font-bold hover:bg-cyan-500 flex items-center gap-1"
                          >
                            <RotateCcw className="h-3 w-3" /> Retry
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 text-[11px] text-slate-500 font-mono border-t border-slate-800 flex items-center justify-between">
                  <span>Verification: {currentPlan.verificationCriteria}</span>
                  <span>Plan ID: {currentPlan.id}</span>
                </div>
              </div>
            )}

            {/* Generated Deliverables Section */}
            {documents.length > 0 && (
              <div className="rounded-2xl bg-[#060a14] border border-cyan-500/30 p-5 space-y-4 shadow-[0_0_30px_rgba(6,182,212,0.08)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-cyan-400" />
                    <h3 className="font-semibold text-white">Latest Generated Deliverable</h3>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(documents[0].markdownContent);
                        alert('Copied markdown to clipboard!');
                      }}
                      className="px-3 py-1 rounded-lg bg-slate-850 border border-slate-700 hover:border-cyan-400 text-slate-200 flex items-center gap-1.5"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </button>
                    <a
                      href={`/api/documents/${documents[0].id}?format=docx`}
                      download
                      className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                    >
                      <Download className="h-3.5 w-3.5" /> DOCX Word
                    </a>
                    <a
                      href={`/api/documents/${documents[0].id}?format=md`}
                      download
                      className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 flex items-center gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5" /> Markdown
                    </a>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#03060c] border border-slate-800 text-sm max-h-96 overflow-y-auto whitespace-pre-wrap font-sans text-slate-300 leading-relaxed">
                  {documents[0].markdownContent}
                </div>

                {documents[0].sources?.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 text-xs font-mono space-y-1.5">
                    <span className="font-semibold text-cyan-400">Grounded SerpApi Citations:</span>
                    <div className="space-y-1">
                      {documents[0].sources.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-cyan-400 hover:underline">
                          <ExternalLink className="h-3 w-3" />
                          <a href={s.url} target="_blank" rel="noreferrer">
                            {s.title}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 2: ACTION QUEUE ===================== */}
        {activeTab === 'queue' && (
          <div className="max-w-5xl w-full mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2 font-mono">
                  <ListTodo className="h-6 w-6 text-cyan-400" />
                  <span>PERSISTENT ACTION QUEUE</span>
                </h2>
                <p className="text-xs font-mono text-slate-400">
                  MongoDB Operational Record: State machine enforcing prerequisite DAG dependencies, retries, and approvals.
                </p>
              </div>
              <button
                onClick={loadInitialData}
                className="px-3 py-1.5 rounded-lg bg-[#060a14] border border-cyan-500/30 hover:border-cyan-400 text-xs font-mono text-cyan-300 flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>

            <div className="space-y-3 font-mono">
              {allTasks.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-[#060a14] border border-slate-800 text-slate-500 text-xs">
                  Action Queue is empty. Transmit a directive from the HUD to dispatch tasks!
                </div>
              ) : (
                allTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-xl bg-[#060a14] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{task.id}</span>
                        <span className="font-bold text-sm text-cyan-300">{task.taskType}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            task.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : task.status === 'waiting_approval'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : task.status === 'failed'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          }`}
                        >
                          {task.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Plan: {task.planId} &bull; Attempts: {task.attemptCount}/{task.maxAttempts} &bull; Created:{' '}
                        {new Date(task.createdAt).toLocaleTimeString()}
                      </div>
                      {task.error && <div className="text-xs text-rose-400 font-medium">Error: {task.error}</div>}
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      {task.status === 'waiting_approval' && (
                        <>
                          <button
                            onClick={() => handleTaskAction(task.id, 'approve')}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                          >
                            Authorize
                          </button>
                          <button
                            onClick={() => handleTaskAction(task.id, 'cancel')}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            Deny
                          </button>
                        </>
                      )}
                      {task.status === 'failed' && (
                        <button
                          onClick={() => handleTaskAction(task.id, 'retry')}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1.5"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Retry
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 3: SCHEDULER ===================== */}
        {activeTab === 'scheduler' && (
          <div className="max-w-5xl w-full mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2 font-mono">
                  <Calendar className="h-6 w-6 text-cyan-400" />
                  <span>DETERMINISTIC SCHEDULER</span>
                </h2>
                <p className="text-xs font-mono text-slate-400">
                  Mathematical time-slot conflict analysis, overdue monitoring, and priority rescheduling.
                </p>
              </div>
            </div>

            {/* Overdue / Conflict Banner */}
            {scheduleAnalysis?.overdueTasks?.length > 0 && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-300 text-xs font-mono">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <div>
                  <span className="font-bold">CRITICAL ATTENTION:</span> {scheduleAnalysis.overdueTasks.length} task(s)
                  past scheduled deadline.
                </div>
              </div>
            )}

            {/* Add Task Form */}
            <form
              onSubmit={handleCreateScheduledTask}
              className="p-5 rounded-2xl bg-[#060a14] border border-cyan-500/20 space-y-3 font-mono text-xs"
            >
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-cyan-400" /> ADD SCHEDULED COMMITMENT
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Directive title..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="md:col-span-2 bg-[#03060c] border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
                <select
                  value={newTaskPriority}
                  onChange={(e: any) => setNewTaskPriority(e.target.value)}
                  className="bg-[#03060c] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
                <input
                  type="number"
                  placeholder="Duration (mins)"
                  value={newTaskDuration}
                  onChange={(e) => setNewTaskDuration(Number(e.target.value))}
                  className="bg-[#03060c] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  Schedule Task
                </button>
              </div>
            </form>

            {/* Scheduled Tasks List with Update Time & Priority Delete */}
            <div className="space-y-3 font-mono text-xs">
              <h3 className="font-semibold text-slate-300">Active Commitments ({scheduledTasks.length})</h3>
              {scheduledTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 rounded-xl bg-[#060a14] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">{task.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold uppercase ${
                          task.priority === 'urgent'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : task.priority === 'high'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        }`}
                      >
                        {task.priority}
                      </span>
                      {task.status === 'overdue' && (
                        <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold">OVERDUE</span>
                      )}
                    </div>
                    <div className="text-slate-400">
                      Duration: {task.estimatedDuration}m &bull; Scheduled:{' '}
                      {task.scheduledStart ? new Date(task.scheduledStart).toLocaleString() : 'Not set'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {editingTaskId === task.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="datetime-local"
                          value={editTaskTime}
                          onChange={(e) => setEditTaskTime(e.target.value)}
                          className="bg-[#03060c] border border-cyan-500 rounded px-2 py-1 text-white text-xs"
                        />
                        <button
                          onClick={() => handleUpdateTaskTime(task.id)}
                          className="px-2.5 py-1 rounded bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingTaskId(null)}
                          className="px-2 py-1 rounded bg-slate-800 text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingTaskId(task.id);
                          setEditTaskTime(task.scheduledStart ? task.scheduledStart.substring(0, 16) : '');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500 text-slate-300 flex items-center gap-1"
                      >
                        <Edit2 className="h-3 w-3 text-cyan-400" /> Change Time
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteScheduledTask(task.id, task.priority)}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 border border-slate-800 transition-colors"
                      title="Delete task"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Proposed Optimized Reschedule */}
            {scheduleAnalysis?.recommendedSchedule?.length > 0 && (
              <div className="p-5 rounded-2xl bg-[#060a14] border border-cyan-500/20 space-y-3 font-mono text-xs">
                <h3 className="font-semibold text-cyan-300 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Proposed Priority-Optimized Reschedule
                </h3>
                <div className="space-y-2">
                  {scheduleAnalysis.recommendedSchedule.map((rec: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-[#03060c] border border-slate-800 flex items-center justify-between"
                    >
                      <span className="font-medium text-white">{rec.title}</span>
                      <span className="text-cyan-400">
                        {new Date(rec.proposedStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {new Date(rec.proposedEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 4: PERSONAL MEMORY ===================== */}
        {activeTab === 'memory' && (
          <div className="max-w-5xl w-full mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2 font-mono">
                  <Brain className="h-6 w-6 text-purple-400" />
                  <span>PERSONAL CONTEXT ENGINE (ATLAS VECTOR SEARCH)</span>
                </h2>
                <p className="text-xs font-mono text-slate-400">
                  Continuous preference extraction, 384-dimensional semantic embeddings, explicit vs. inferred segregation.
                </p>
              </div>
              <button
                onClick={handleWipeMemories}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-black border border-rose-500/30 text-xs font-mono font-bold transition-all flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" /> Wipe Memories
              </button>
            </div>

            {/* Add Memory Form */}
            <form
              onSubmit={handleAddMemory}
              className="p-4 rounded-xl bg-[#060a14] border border-cyan-500/20 space-y-2 font-mono text-xs"
            >
              <h3 className="font-semibold text-white">Record Explicit Preference / Constraint</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. User prefers concise technical documents with structured tables."
                  value={newMemoryContent}
                  onChange={(e) => setNewMemoryContent(e.target.value)}
                  className="flex-1 bg-[#03060c] border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  Store Memory
                </button>
              </div>
            </form>

            {/* Memory List */}
            <div className="space-y-3 font-mono text-xs">
              {memories.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-[#060a14] border border-slate-800 text-slate-500">
                  No memories currently stored. Tell Jarvis your preferences!
                </div>
              ) : (
                memories.map((m) => (
                  <div
                    key={m.id}
                    className="p-4 rounded-xl bg-[#060a14] border border-slate-800 flex items-center justify-between"
                  >
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            m.type === 'explicit'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {m.type}
                        </span>
                        <span className="text-slate-500 capitalize">({m.category})</span>
                        <span className="text-emerald-400 font-mono">
                          Confidence: {Math.round(m.confidence * 100)}%
                        </span>
                        {m.embedding && (
                          <span className="text-[10px] text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/30">
                            384-DIM VECTOR
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-sans font-medium text-slate-200">{m.content}</p>
                      {m.sourceInteraction && (
                        <div className="text-[10px] text-slate-500">
                          Source: &ldquo;{m.sourceInteraction}&rdquo;
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteMemory(m.id)}
                      className="p-2 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete memory"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 5: DOCUMENTS ===================== */}
        {activeTab === 'documents' && (
          <div className="max-w-5xl w-full mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2 font-mono">
                  <FileText className="h-6 w-6 text-cyan-400" />
                  <span>DOCUMENT ARCHIVES</span>
                </h2>
                <p className="text-xs font-mono text-slate-400">
                  Research deliverables, comparisons, and email drafts exportable to native Microsoft Word (.docx) and Markdown.
                </p>
              </div>
            </div>

            {documents.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-[#060a14] border border-slate-800 text-slate-500 text-xs font-mono">
                No documents generated yet. Instruct Jarvis to run research or generate a report!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => setActiveDoc(doc)}
                      className={`w-full text-left p-3.5 rounded-xl border text-xs font-mono transition-all ${
                        activeDoc?.id === doc.id
                          ? 'bg-cyan-500/10 border-cyan-500/50 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                          : 'bg-[#060a14] border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold text-sm line-clamp-1">{doc.title}</div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {new Date(doc.createdAt).toLocaleDateString()} &bull; {doc.type}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="md:col-span-2 rounded-2xl bg-[#060a14] border border-cyan-500/20 p-5 space-y-4">
                  {activeDoc ? (
                    <>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono">
                        <h3 className="font-bold text-white text-sm">{activeDoc.title}</h3>
                        <div className="flex gap-2 text-xs">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(activeDoc.markdownContent);
                              alert('Copied to clipboard!');
                            }}
                            className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:border-cyan-400 flex items-center gap-1"
                          >
                            <Copy className="h-3 w-3" /> Copy
                          </button>
                          <a
                            href={`/api/documents/${activeDoc.id}?format=docx`}
                            download
                            className="px-3 py-1 rounded bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 flex items-center gap-1 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                          >
                            <Download className="h-3 w-3" /> DOCX
                          </a>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-[#03060c] border border-slate-800 text-sm max-h-[600px] overflow-y-auto whitespace-pre-wrap font-sans text-slate-300 leading-relaxed">
                        {activeDoc.markdownContent}
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-600 text-center py-12 font-mono text-xs">
                      Select a document to preview.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 6: OBSERVABILITY ===================== */}
        {activeTab === 'traces' && (
          <div className="max-w-5xl w-full mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2 font-mono">
                  <Activity className="h-6 w-6 text-emerald-400" />
                  <span>SENTRY OBSERVABILITY & LATENCY SPANS</span>
                </h2>
                <p className="text-xs font-mono text-slate-400">
                  Distributed correlation IDs (`traceId`, `planId`, `taskId`), execution spans, and latency benchmarks.
                </p>
              </div>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {traces.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-[#060a14] border border-slate-800 text-slate-500">
                  No trace spans recorded yet.
                </div>
              ) : (
                traces.map((trace) => (
                  <div
                    key={trace.id}
                    className="p-4 rounded-xl bg-[#060a14] border border-slate-800 flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{trace.spanName}</span>
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            trace.status === 'ok' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {trace.status.toUpperCase()}
                        </span>
                        <span className="text-cyan-400 font-mono">({trace.durationMs}ms)</span>
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Trace: {trace.traceId} {trace.planId && `| Plan: ${trace.planId}`}
                      </div>
                      {trace.tags && (
                        <div className="text-slate-600 text-[10px]">Tags: {JSON.stringify(trace.tags)}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 7: SETTINGS & HEALTH ===================== */}
        {activeTab === 'settings' && (
          <div className="max-w-5xl w-full mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2 font-mono">
                  <Settings className="h-6 w-6 text-slate-400" />
                  <span>SYSTEM HEALTH & PRIZE TARGETS</span>
                </h2>
                <p className="text-xs font-mono text-slate-400">
                  Verified partner technology status for Hacktoberfest Week 2 challenge.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              <div className="p-5 rounded-2xl bg-[#060a14] border border-cyan-500/20 space-y-2">
                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                  Open-Weight AI Model (Gemma)
                </span>
                <div className="text-base font-bold text-white font-sans">
                  {systemStatus?.ai?.provider || 'Gemma 2 9B'}
                </div>
                <p className="text-slate-400 text-[11px] font-sans">
                  Orchestrates request interpretation, DAG planning, tool selection, synthesis, and memory extraction.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#060a14] border border-cyan-500/20 space-y-2">
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                  Operational Database (MongoDB Atlas)
                </span>
                <div className="text-base font-bold text-white font-sans">
                  {systemStatus?.database?.type || 'MongoDB Store'}
                </div>
                <p className="text-slate-400 text-[11px] font-sans">
                  Persists plans, queued tasks, and 384-dimensional vector embeddings for Atlas Vector Search.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#060a14] border border-cyan-500/20 space-y-2">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                  Live Web Research (SerpApi)
                </span>
                <div className="text-base font-bold text-white font-sans">
                  {systemStatus?.search?.provider || 'SerpApi'}
                </div>
                <p className="text-slate-400 text-[11px] font-sans">
                  Executes live Google queries, extracts organic source metadata, and grounds claims in verified URLs.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#060a14] border border-cyan-500/20 space-y-2">
                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                  Voice & Audio Interface (ElevenLabs)
                </span>
                <div className="text-base font-bold text-white font-sans">
                  {systemStatus?.voice?.provider || 'ElevenLabs Turbo'}
                </div>
                <p className="text-slate-400 text-[11px] font-sans">
                  First-class speech recognition and natural spoken audio summaries.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
