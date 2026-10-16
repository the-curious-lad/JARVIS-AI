import { describe, it, expect } from 'vitest';
import { executeWebResearch } from '@/lib/workers/researchWorker';
import { documentWorker } from '@/lib/workers/documentWorker';
import { generateEmailDraft } from '@/lib/workers/emailWorker';

describe('Mini-Workers Implementation', () => {
  it('should run research worker and return findings with verified sources', async () => {
    const res = await executeWebResearch({ query: 'open-weight models 2026' });
    expect(res.sources.length).toBeGreaterThan(0);
    expect(res.findings.length).toBeGreaterThan(20);
    expect(res.sources[0].url).toMatch(/^https?:\/\//);
  });

  it('should generate formatted markdown with source citations', () => {
    const md = documentWorker.generateFormattedMarkdown({
      title: 'Open Source AI Models',
      summary: 'Executive overview',
      findings: 'Detailed technical analysis',
      sources: [
        {
          title: 'Google DeepMind Gemma Report',
          url: 'https://example.com/gemma',
          snippet: 'Benchmark analysis',
        },
      ],
    });

    expect(md).toContain('# Open Source AI Models');
    expect(md).toContain('## Executive Summary');
    expect(md).toContain('[Google DeepMind Gemma Report](https://example.com/gemma)');
  });

  it('should generate native DOCX binary buffer without error', async () => {
    const doc = await documentWorker.createDocument({
      userId: 'test_docx_user',
      title: 'Docx Test File',
      type: 'research_report',
      markdownContent: '# Heading 1\n\nParagraph text.\n\n- Bullet item\n> Blockquote',
      sources: [{ title: 'Source 1', url: 'https://example.com' }],
    });

    const buffer = await documentWorker.generateDocxBuffer(doc);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(500); // Valid docx zip archive size
  });

  it('should generate email draft without automatically sending', async () => {
    const draft = await generateEmailDraft({
      context: 'Inform team of the completed research report',
      recipient: 'Engineering Team',
      tonePreference: 'Concise and professional',
    });

    expect(draft.subject).toBeDefined();
    expect(draft.body).toBeDefined();
    expect(draft.status).toBe('draft_ready');
    expect(draft.requiresApproval).toBe(true);
  });
});
