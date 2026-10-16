import { Memory, MemoryCategory, MemoryObservation } from '@/types';
import { getDb } from '@/lib/db/client';
import { getGemmaProvider } from '@/lib/ai/gemma';
import { generateEmbedding, promptRewriter } from '@/lib/ai/promptRewriter';

export class PersonalContextEngine {
  private collectionName = 'memories';
  private observationCollectionName = 'memory_observations';

  private async getCollection() {
    const db = await getDb();
    return db.collection(this.collectionName);
  }

  private async getObservationCollection() {
    const db = await getDb();
    return db.collection(this.observationCollectionName);
  }

  // 1. Candidate Memory Extraction from user interaction or completed task result
  async evaluateInteraction(params: {
    userId: string;
    userRequest: string;
    taskResultSummary?: string;
    sourceTaskId?: string;
    allowInferred?: boolean;
  }): Promise<Memory[]> {
    const { userId, userRequest, taskResultSummary, sourceTaskId, allowInferred = true } = params;

    // Check for explicit preference phrases directly in the text
    const explicitObservations: Array<{
      content: string;
      category: MemoryCategory;
      confidence: number;
      type: 'explicit';
    }> = [];

    const lowerReq = userRequest.toLowerCase();
    if (lowerReq.includes('i prefer') || lowerReq.includes('remember that') || lowerReq.includes('my preference is')) {
      let extractedPref = '';
      if (lowerReq.includes('remember that')) {
        extractedPref = userRequest.substring(lowerReq.indexOf('remember that') + 'remember that'.length).trim();
      } else if (lowerReq.includes('i prefer')) {
        extractedPref = userRequest.substring(lowerReq.indexOf('i prefer') + 'i prefer'.length).trim();
      } else {
        extractedPref = userRequest;
      }

      // Determine category
      let cat: MemoryCategory = 'preference';
      if (extractedPref.includes('schedule') || extractedPref.includes('hour') || extractedPref.includes('morning')) {
        cat = 'scheduling';
      } else if (extractedPref.includes('format') || extractedPref.includes('table') || extractedPref.includes('concise')) {
        cat = 'preference';
      } else if (extractedPref.includes('project') || extractedPref.includes('working on')) {
        cat = 'project';
      }

      explicitObservations.push({
        content: extractedPref.replace(/^[:\s]+/, ''),
        category: cat,
        confidence: 0.98,
        type: 'explicit',
      });
    }

    // Inferred observations through Gemma Model Provider
    const model = getGemmaProvider();
    const prompt = `Analyze this interaction for user preferences, patterns, or constraints.
User Request: "${userRequest}"
Task Result: "${taskResultSummary || 'N/A'}"

Extract candidate observations as JSON array of objects:
[
  {
    "candidateContent": string,
    "category": "preference" | "profile" | "project" | "goal" | "scheduling" | "pattern",
    "suggestedType": "explicit" | "inferred",
    "confidence": number between 0.1 and 1.0,
    "rationale": string
  }
]
Do not store single transient topics as long-term interests.`;

    let candidates: any[] = [];
    try {
      candidates = await model.generateStructured<any[]>(prompt, 'JSON array of candidate observations', () => []);
    } catch {
      candidates = [];
    }

    const createdMemories: Memory[] = [];

    // Process explicit ones first
    for (const exp of explicitObservations) {
      const memory = await this.saveOrUpdateMemory({
        userId,
        content: exp.content,
        category: exp.category,
        type: 'explicit',
        confidence: exp.confidence,
        sourceTaskId,
        sourceInteraction: userRequest,
      });
      createdMemories.push(memory);
    }

    // Process inferred candidates if allowed
    if (allowInferred && Array.isArray(candidates)) {
      for (const cand of candidates) {
        if (!cand.candidateContent || cand.confidence < 0.7) continue;

        // Save raw observation for auditability
        const obsColl = await this.getObservationCollection();
        await obsColl.insertOne({
          userId,
          sourceInteraction: userRequest,
          candidateContent: cand.candidateContent,
          category: cand.category || 'preference',
          suggestedType: cand.suggestedType || 'inferred',
          confidence: cand.confidence,
          rationale: cand.rationale || '',
          validated: true,
          createdAt: new Date().toISOString(),
        });

        // Store inferred memory if not duplicate
        const memory = await this.saveOrUpdateMemory({
          userId,
          content: cand.candidateContent,
          category: cand.category || 'preference',
          type: cand.suggestedType === 'explicit' ? 'explicit' : 'inferred',
          confidence: cand.confidence,
          sourceTaskId,
          sourceInteraction: userRequest,
        });
        createdMemories.push(memory);
      }
    }

    return createdMemories;
  }

  // 2. Deduplication and Upsert with Provenance
  async saveOrUpdateMemory(params: {
    userId: string;
    content: string;
    category: MemoryCategory;
    type: 'explicit' | 'inferred';
    confidence: number;
    sourceTaskId?: string;
    sourceInteraction?: string;
  }): Promise<Memory> {
    const coll = await this.getCollection();
    const existing = await coll.find({ userId: params.userId, isDeleted: false });

    // Deduplication check: check if a very similar memory already exists
    const normalizedNew = params.content.toLowerCase().trim();
    const existingMatch = existing.find((m: Memory) => {
      const normExisting = m.content.toLowerCase().trim();
      return normExisting.includes(normalizedNew) || normalizedNew.includes(normExisting);
    });

    const now = new Date().toISOString();

    // Compute 384-dimensional semantic embedding vector
    const embedding = generateEmbedding(params.content);

    if (existingMatch) {
      // If the incoming memory is explicit and the existing is inferred, upgrade it!
      const shouldUpgradeType = params.type === 'explicit' && existingMatch.type === 'inferred';
      const updatedConfidence = Math.max(existingMatch.confidence, params.confidence);

      await coll.updateOne(
        { id: existingMatch.id, userId: params.userId },
        {
          $set: {
            content: params.content,
            type: shouldUpgradeType ? 'explicit' : existingMatch.type,
            confidence: updatedConfidence,
            embedding,
            updatedAt: now,
            sourceInteraction: params.sourceInteraction || existingMatch.sourceInteraction,
          },
        }
      );

      return (await coll.findOne({ id: existingMatch.id, userId: params.userId }))!;
    }

    // Insert new memory with vector embedding
    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newMemory: Memory = {
      id,
      userId: params.userId,
      category: params.category,
      content: params.content,
      type: params.type,
      confidence: params.confidence,
      embedding,
      sourceTaskId: params.sourceTaskId,
      sourceInteraction: params.sourceInteraction,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    };

    await coll.insertOne(newMemory);
    return newMemory;
  }

  // 3. Retrieval for Prompt Augmentation (with Atlas Vector Search / Reranking)
  async getRelevantContext(userId: string, query?: string): Promise<{
    formattedSummary: string;
    memories: Memory[];
  }> {
    const coll = await this.getCollection();
    const allMemories: Memory[] = await coll.find({ userId, isDeleted: false });

    if (allMemories.length === 0) {
      return { formattedSummary: 'No previous user preferences or context stored.', memories: [] };
    }

    let relevantMemories: Memory[] = allMemories;

    // If query provided, run semantic vector retrieval and reranking
    if (query && query.trim().length > 0) {
      const queryVector = generateEmbedding(query);
      relevantMemories = promptRewriter.rerankMemories(queryVector, allMemories, 4);
    } else {
      // Sort by explicit first, then confidence and recency
      relevantMemories = allMemories.sort((a, b) => {
        if (a.type === 'explicit' && b.type !== 'explicit') return -1;
        if (b.type === 'explicit' && a.type !== 'explicit') return 1;
        return b.confidence - a.confidence;
      }).slice(0, 5);
    }

    const lines = relevantMemories.map(
      (m) => `- [${m.type.toUpperCase()}] (${m.category}): ${m.content} (Confidence: ${Math.round(m.confidence * 100)}%)`
    );

    const formattedSummary = `Known User Preferences & Context:\n${lines.join('\n')}`;
    return { formattedSummary, memories: relevantMemories };
  }

  // 4. Privacy Controls: inspect, update, delete, wipe
  async getAllMemories(userId: string): Promise<Memory[]> {
    const coll = await this.getCollection();
    return await coll.find({ userId, isDeleted: false });
  }

  async updateMemory(id: string, userId: string, content: string, category?: MemoryCategory): Promise<Memory | null> {
    const coll = await this.getCollection();
    const update: any = { content, updatedAt: new Date().toISOString() };
    if (category) update.category = category;

    await coll.updateOne({ id, userId }, { $set: update });
    return await coll.findOne({ id, userId });
  }

  async deleteMemory(id: string, userId: string): Promise<boolean> {
    const coll = await this.getCollection();
    const res = await coll.updateOne({ id, userId }, { $set: { isDeleted: true, updatedAt: new Date().toISOString() } });
    return res.modifiedCount > 0;
  }

  async wipeAllMemories(userId: string): Promise<number> {
    const coll = await this.getCollection();
    const res = await coll.updateMany({ userId }, { $set: { isDeleted: true, updatedAt: new Date().toISOString() } });
    return res.modifiedCount;
  }
}

export const contextEngine = new PersonalContextEngine();
