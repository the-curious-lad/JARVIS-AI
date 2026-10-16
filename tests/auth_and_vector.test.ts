import { describe, it, expect } from 'vitest';
import { userStore } from '@/lib/auth/userStore';
import { generateEmbedding, cosineSimilarity, promptRewriter } from '@/lib/ai/promptRewriter';
import { chatStore } from '@/lib/chat/chatStore';
import { contextEngine } from '@/lib/memory/contextEngine';

describe('User Authentication & Onboarding Protocol', () => {
  const email = `tony_${Date.now()}@stark.com`;

  it('should register a new user and seed initial explicit preferences', async () => {
    const user = await userStore.createUser({
      name: 'Tony Stark',
      email,
      password: 'IronManPassword123',
      callsign: 'Sir',
      preferredTone: 'Concise technical documents with structured tables',
      workHours: '09:00 - 13:00',
    });

    expect(user.id).toBeDefined();
    expect(user.callsign).toBe('Sir');

    // Verify initial memories were seeded with 100% confidence
    const memories = await contextEngine.getAllMemories(user.id);
    expect(memories.length).toBeGreaterThanOrEqual(3);
    const callsignMem = memories.find((m) => m.content.includes('Sir'));
    expect(callsignMem).toBeDefined();
    expect(callsignMem?.type).toBe('explicit');
    expect(callsignMem?.confidence).toBe(1.0);
  });

  it('should authenticate user with valid credentials', async () => {
    const authUser = await userStore.authenticate(email, 'IronManPassword123');
    expect(authUser.email).toBe(email);
  });

  it('should reject invalid credentials', async () => {
    await expect(userStore.authenticate(email, 'WrongPassword')).rejects.toThrow();
  });
});

describe('Vector Search & Semantic Reranking', () => {
  it('should generate 384-dimensional normalized vector embeddings', () => {
    const vecA = generateEmbedding('User prefers concise technical reports with tables');
    expect(vecA.length).toBe(384);

    // Verify L2 norm is approximately 1.0
    let sumSq = 0;
    for (const v of vecA) sumSq += v * v;
    expect(Math.abs(Math.sqrt(sumSq) - 1.0)).toBeLessThan(0.01);
  });

  it('should compute higher cosine similarity for semantically related text', () => {
    const query = generateEmbedding('technical report with table comparison');
    const match = generateEmbedding('User prefers technical documents and structured tables');
    const mismatch = generateEmbedding('User likes cooking pasta on weekends');

    const scoreMatch = cosineSimilarity(query, match);
    const scoreMismatch = cosineSimilarity(query, mismatch);

    expect(scoreMatch).toBeGreaterThan(scoreMismatch);
  });
});

describe('Multi-Chat Session Store & Rolling Compactor', () => {
  const testUserId = `chat_user_${Date.now()}`;

  it('should create and list conversations', async () => {
    const conv = await chatStore.createConversation(testUserId, 'Autonomous Directives');
    expect(conv.id).toBeDefined();

    const list = await chatStore.listConversations(testUserId);
    expect(list.some((c) => c.id === conv.id)).toBe(true);
  });

  it('should append messages and update conversation metadata', async () => {
    const conv = await chatStore.createConversation(testUserId, 'Test Chat');
    const msg = await chatStore.addMessage({
      conversationId: conv.id,
      userId: testUserId,
      role: 'user',
      content: 'Hello Jarvis, prepare diagnostic report.',
    });

    expect(msg.id).toBeDefined();
    const messages = await chatStore.getMessages(conv.id, testUserId);
    expect(messages.length).toBe(1);
    expect(messages[0].content).toContain('diagnostic report');
  });
});
