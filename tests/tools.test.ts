import { describe, it, expect, beforeEach } from 'vitest';
import { globalToolRegistry } from '@/lib/tools/registry';
import '@/lib/tools/setup';

describe('Tool Registry & Security Constraints', () => {
  it('should have core tools registered', () => {
    expect(globalToolRegistry.has('research_search')).toBe(true);
    expect(globalToolRegistry.has('document_create')).toBe(true);
    expect(globalToolRegistry.has('email_draft')).toBe(true);
    expect(globalToolRegistry.has('schedule_manage')).toBe(true);
  });

  it('should reject execution of unregistered tools', async () => {
    await expect(
      globalToolRegistry.execute('unregistered_shell_command', {}, { userId: 'u1' })
    ).rejects.toThrow(/Tool not registered/);
  });

  it('should validate tool inputs and reject invalid arguments', async () => {
    // research_search expects query to have min length 2
    await expect(
      globalToolRegistry.execute('research_search', { query: '' }, { userId: 'u1' })
    ).rejects.toThrow(/Invalid arguments/);
  });

  it('should successfully execute registered research tool with valid arguments', async () => {
    const res = await globalToolRegistry.execute(
      'research_search',
      { query: 'test query for unit testing' },
      { userId: 'u1' }
    );
    expect(res).toBeDefined();
    expect(res.sources).toBeDefined();
    expect(Array.isArray(res.sources)).toBe(true);
  });
});
