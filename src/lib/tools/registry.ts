import { z } from 'zod';

export interface RegisteredTool<TInput = any, TOutput = any> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TOutput>;
  requiredPermissions: string[];
  requiresApproval: boolean;
  category: 'research' | 'document' | 'email' | 'scheduling' | 'system';
  execute: (input: TInput, context: ToolExecutionContext) => Promise<TOutput>;
}

export interface ToolExecutionContext {
  userId: string;
  planId?: string;
  taskId?: string;
}

class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();

  register<TInput, TOutput>(tool: RegisteredTool<TInput, TOutput>) {
    this.tools.set(tool.name, tool);
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  getDescriptions(): Array<{ name: string; description: string; requiresApproval: boolean; inputShape: string }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      requiresApproval: t.requiresApproval,
      inputShape: t.inputSchema.description || 'Structured Object',
    }));
  }

  async execute(name: string, input: any, context: ToolExecutionContext): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not registered: "${name}". Execution denied.`);
    }

    // Validate input through Zod schema
    const parsedInput = tool.inputSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new Error(
        `Invalid arguments for tool "${name}": ${parsedInput.error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ')}`
      );
    }

    return await tool.execute(parsedInput.data, context);
  }
}

export const globalToolRegistry = new ToolRegistry();
