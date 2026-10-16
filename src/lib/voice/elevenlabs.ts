export interface VoiceSynthesisResult {
  audioBuffer?: Buffer;
  mimeType: string;
  isFallback: boolean;
  message?: string;
}

export async function synthesizeSpeech(text: string): Promise<VoiceSynthesisResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Adam (Jarvis voice, free-tier supported)

  if (apiKey && apiKey.trim().length > 0) {
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return {
          audioBuffer: Buffer.from(arrayBuffer),
          mimeType: 'audio/mpeg',
          isFallback: false,
        };
      } else {
        console.warn(`ElevenLabs API returned ${response.status}: ${await response.text()}`);
      }
    } catch (err) {
      console.warn('ElevenLabs API request failed:', err);
    }
  }

  // Fallback: Notify client to synthesize via Web Speech API
  return {
    mimeType: 'text/plain',
    isFallback: true,
    message: 'ElevenLabs API key not configured. Using browser Web Speech API for voice playback.',
  };
}
