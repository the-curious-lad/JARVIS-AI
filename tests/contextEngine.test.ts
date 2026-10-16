import { describe, it, expect } from 'vitest';
import { contextEngine } from '@/lib/memory/contextEngine';

describe('Personal Context Engine', () => {
  const userA = `user_a_${Date.now()}`;
  const userB = `user_b_${Date.now()}`;

  it('should extract explicit preferences accurately', async () => {
    const memories = await contextEngine.evaluateInteraction({
      userId: userA,
      userRequest: 'Remember that I prefer concise technical documents with tables.',
    });

    expect(memories.length).toBeGreaterThan(0);
    const explicitMem = memories.find((m) => m.type === 'explicit');
    expect(explicitMem).toBeDefined();
    expect(explicitMem?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('should deduplicate and upgrade memories', async () => {
    // 1. First add inferred memory
    const inferred = await contextEngine.saveOrUpdateMemory({
      userId: userA,
      content: 'User prefers concise summaries',
      category: 'preference',
      type: 'inferred',
      confidence: 0.75,
    });

    expect(inferred.type).toBe('inferred');

    // 2. Later, user explicitly states it
    const explicit = await contextEngine.saveOrUpdateMemory({
      userId: userA,
      content: 'User prefers concise summaries',
      category: 'preference',
      type: 'explicit',
      confidence: 0.98,
    });

    // Should update existing entry and upgrade type
    expect(explicit.id).toBe(inferred.id);
    expect(explicit.type).toBe('explicit');
    expect(explicit.confidence).toBe(0.98);
  });

  it('should isolate data between users', async () => {
    await contextEngine.saveOrUpdateMemory({
      userId: userA,
      content: 'Secret project Alpha',
      category: 'project',
      type: 'explicit',
      confidence: 1.0,
    });

    const userBContext = await contextEngine.getRelevantContext(userB);
    expect(userBContext.memories.some((m) => m.content.includes('Alpha'))).toBe(false);
  });

  it('should support memory deletion and wipe all', async () => {
    const mem = await contextEngine.saveOrUpdateMemory({
      userId: userA,
      content: 'Temporary preference',
      category: 'preference',
      type: 'inferred',
      confidence: 0.8,
    });

    // Single delete
    const deleted = await contextEngine.deleteMemory(mem.id, userA);
    expect(deleted).toBe(true);

    const activeMems = await contextEngine.getAllMemories(userA);
    expect(activeMems.some((m) => m.id === mem.id)).toBe(false);

    // Wipe all
    const count = await contextEngine.wipeAllMemories(userA);
    expect(count).toBeGreaterThanOrEqual(0);

    const remaining = await contextEngine.getAllMemories(userA);
    expect(remaining.length).toBe(0);
  });
});
