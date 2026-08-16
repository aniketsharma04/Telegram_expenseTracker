/**
 * Voice-note transcription (v2) via Groq's Whisper endpoint — free tier,
 * fast, and accepts Telegram's OGG/Opus voice files directly.
 * Requires GROQ_API_KEY; without it the bot tells the user voice isn't set up.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3-turbo";

export function voiceConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

export async function transcribeVoice(audio: ArrayBuffer, mimeType: string): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  const form = new FormData();
  form.append("file", new Blob([audio], { type: mimeType || "audio/ogg" }), "voice.ogg");
  form.append("model", MODEL);
  form.append("temperature", "0");
  form.append("response_format", "text");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    console.error("transcription failed", res.status, await res.text());
    return null;
  }
  const text = (await res.text()).trim();
  return text.length > 0 ? text : null;
}
