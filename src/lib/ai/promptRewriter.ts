import { getGemmaProvider } from './gemma';
import { Memory } from '@/types';

// Deterministic 384-dimensional vector embedding generator
export function generateEmbedding(text: string): number[] {
  const dimensions = 384;
  const embedding = new Array(dimensions).fill(0);
  const clean = text.toLowerCase().trim();

  if (!clean) return embedding;

  // Compute character n-gram hash distribution for semantic feature vectors
  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    const pos = (charCode * 31 + i * 17) % dimensions;
    embedding[pos] += Math.sin(charCode + i);

    if (i < clean.length - 1) {
      const bigramCode = charCode * 256 + clean.charCodeAt(i + 1);
      const biPos = (bigramCode * 13) % dimensions;
      embedding[biPos] += Math.cos(bigramCode);
    }
  }

  // Normalize vector to unit length (L2 norm)
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) {
    sumSq += embedding[i] * embedding[i];
  }

  const norm = Math.sqrt(sumSq) || 1;
  return embedding.map((v) => v / norm);
}

// Cosine similarity between two normalized vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }
  return dotProduct;
}

export interface PromptRewriteResult {
  originalPrompt: string;
  semanticSearchQuery: string;
  keywords: string[];
  intentSummary: string;
}

export class PromptRewriter {
  async rewritePromptAndExtractKeywords(userPrompt: string): Promise<PromptRewriteResult> {
    const model = getGemmaProvider();
    const prompt = `You are Jarvis Query Rewriter and Semantic Keyword Extractor.
Analyze this user command to extract optimal semantic keywords for personal memory vector search.

User Command: "${userPrompt}"

Output strictly a JSON object:
{
  "semanticSearchQuery": "concise query targeting user formatting, scheduling habits, or relevant project constraints",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "intentSummary": "1-sentence summary of intended action"
}`;

    try {
      const structured = await model.generateStructured<any>(prompt, 'Prompt rewrite JSON', () => ({
        semanticSearchQuery: userPrompt,
        keywords: userPrompt.split(' ').filter((w) => w.length > 3),
        intentSummary: userPrompt,
      }));

      return {
        originalPrompt: userPrompt,
        semanticSearchQuery: structured.semanticSearchQuery || userPrompt,
        keywords: Array.isArray(structured.keywords) ? structured.keywords : [userPrompt],
        intentSummary: structured.intentSummary || userPrompt,
      };
    } catch {
      return {
        originalPrompt: userPrompt,
        semanticSearchQuery: userPrompt,
        keywords: userPrompt.split(' ').filter((w) => w.length > 3),
        intentSummary: userPrompt,
      };
    }
  }

  // Reranks candidate memories using vector similarity + explicit weighting + confidence
  rerankMemories(queryVector: number[], candidateMemories: Memory[], topK = 4): Memory[] {
    const scored = candidateMemories.map((mem) => {
      let sim = 0;
      if (mem.embedding && mem.embedding.length === queryVector.length) {
        sim = cosineSimilarity(queryVector, mem.embedding);
      } else {
        // Fallback similarity if embedding absent
        const memVec = generateEmbedding(mem.content);
        sim = cosineSimilarity(queryVector, memVec);
      }

      // Bonus for explicit user preferences and high confidence
      const explicitBonus = mem.type === 'explicit' ? 0.25 : 0.05;
      const confidenceWeight = (mem.confidence || 0.8) * 0.2;
      const totalScore = sim * 0.55 + explicitBonus + confidenceWeight;

      return { memory: mem, score: totalScore };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((item) => item.memory);
  }
}

export const promptRewriter = new PromptRewriter();
