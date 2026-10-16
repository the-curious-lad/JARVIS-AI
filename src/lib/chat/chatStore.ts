import { getDb } from '@/lib/db/client';
import { getGemmaProvider } from '@/lib/ai/gemma';

export interface ChatConversation {
  id: string;
  userId: string;
  title: string;
  rollingSummary?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export class ChatStore {
  private convColl = 'conversations';
  private msgColl = 'messages';

  private async getConvCollection() {
    const db = await getDb();
    return db.collection(this.convColl);
  }

  private async getMsgCollection() {
    const db = await getDb();
    return db.collection(this.msgColl);
  }

  async createConversation(userId: string, title?: string): Promise<ChatConversation> {
    const coll = await this.getConvCollection();
    const id = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const conv: ChatConversation = {
      id,
      userId,
      title: title || 'New JARVIS Directive',
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await coll.insertOne(conv);
    return conv;
  }

  async listConversations(userId: string): Promise<ChatConversation[]> {
    const coll = await this.getConvCollection();
    const list: ChatConversation[] = await coll.find({ userId });
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getConversation(id: string, userId: string): Promise<ChatConversation | null> {
    const coll = await this.getConvCollection();
    return await coll.findOne({ id, userId });
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    const convColl = await this.getConvCollection();
    const msgColl = await this.getMsgCollection();

    await convColl.deleteOne({ id, userId });
    await msgColl.deleteMany({ conversationId: id, userId });
    return true;
  }

  async addMessage(params: {
    conversationId: string;
    userId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
  }): Promise<ChatMessage> {
    const msgColl = await this.getMsgCollection();
    const convColl = await this.getConvCollection();

    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const msg: ChatMessage = {
      id,
      conversationId: params.conversationId,
      userId: params.userId,
      role: params.role,
      content: params.content,
      timestamp: now,
    };

    await msgColl.insertOne(msg);

    // Update conversation metadata
    const allMsgs: ChatMessage[] = await msgColl.find({ conversationId: params.conversationId });
    const count = allMsgs.length;

    // First user message automatically sets the title
    let titleUpdate: Record<string, any> = { messageCount: count, updatedAt: now };
    if (params.role === 'user' && count <= 2) {
      titleUpdate.title = params.content.length > 40 ? params.content.substring(0, 37) + '...' : params.content;
    }

    // Rolling Context Compaction: If messages > 6, compress older turns into a 2-sentence summary
    if (count > 6 && count % 4 === 0) {
      try {
        const olderMsgs = allMsgs.slice(0, allMsgs.length - 4);
        const model = getGemmaProvider();
        const summaryPrompt = `Summarize the essential context and facts from this conversation history in 2 concise sentences for subsequent prompt injection:\n${olderMsgs
          .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
          .join('\n')}`;

        const summary = await model.generateText(summaryPrompt, { maxTokens: 120 });
        titleUpdate.rollingSummary = summary.trim();
      } catch (err) {
        console.warn('Rolling context compaction error:', err);
      }
    }

    await convColl.updateOne({ id: params.conversationId, userId: params.userId }, { $set: titleUpdate });

    return msg;
  }

  async getMessages(conversationId: string, userId: string): Promise<ChatMessage[]> {
    const msgColl = await this.getMsgCollection();
    const msgs: ChatMessage[] = await msgColl.find({ conversationId, userId });
    return msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // Returns compact context: rollingSummary + last 4 messages for fast Gemma execution
  async getCompactContextForAI(conversationId: string, userId: string): Promise<{
    summary: string;
    recentMessages: ChatMessage[];
  }> {
    const conv = await this.getConversation(conversationId, userId);
    const msgs = await this.getMessages(conversationId, userId);

    const recent = msgs.slice(-4);
    const summary = conv?.rollingSummary || '';

    return {
      summary,
      recentMessages: recent,
    };
  }
}

export const chatStore = new ChatStore();
