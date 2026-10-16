import { getGemmaProvider } from '@/lib/ai/gemma';

export interface EmailDraftResult {
  subject: string;
  body: string;
  recipient?: string;
  tone: string;
  requiresApproval: boolean;
  status: 'draft_ready';
}

export async function generateEmailDraft(params: {
  context: string;
  recipient?: string;
  tonePreference?: string;
}): Promise<EmailDraftResult> {
  const { context, recipient = 'Team', tonePreference = 'Professional and concise' } = params;

  const model = getGemmaProvider();
  const prompt = `You are Jarvis Email Draft Worker.
Draft a professional email based on the following context.
Context / Objective: "${context}"
Recipient: "${recipient}"
User Preference Tone: "${tonePreference}"

Format as:
Subject: <Clear Subject Line>

<Email Body>

Do NOT send the email. This is strictly a draft.`;

  const output = await model.generateText(prompt, { temperature: 0.2 });

  let subject = 'Follow-up regarding project update';
  let body = output;

  const subjectMatch = output.match(/^Subject:\s*(.*)$/im);
  if (subjectMatch) {
    subject = subjectMatch[1].trim();
    body = output.replace(/^Subject:\s*.*$/im, '').trim();
  }

  return {
    subject,
    body,
    recipient,
    tone: tonePreference,
    requiresApproval: true,
    status: 'draft_ready',
  };
}
