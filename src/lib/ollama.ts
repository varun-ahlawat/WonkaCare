/**
 * Ollama local AI client for on-premise / air-gapped deployments.
 *
 * Environment variables:
 *   AI_PROVIDER=ollama
 *   OLLAMA_BASE_URL=http://localhost:11434   (default)
 *   OLLAMA_MODEL=llama3                      (default)
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

export function isOllamaEnabled(): boolean {
  return process.env.AI_PROVIDER?.toLowerCase() === 'ollama';
}

/** Generate a completion using the local Ollama instance. */
export async function ollamaGenerate(
  parts: { text: string }[],
  model = OLLAMA_MODEL,
  timeoutMs = 60_000,
): Promise<string> {
  const prompt = parts.map((p) => p.text).join('\n\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${OLLAMA_BASE_URL}/api/generate`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0,
          num_predict: 4096,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data?.response;
    if (!text) {
      throw new Error(
        `Ollama: unexpected response shape — ${JSON.stringify(data).slice(0, 200)}`,
      );
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Chat-style completion using Ollama's /api/chat endpoint. */
export async function ollamaChat(
  systemPrompt: string,
  userMessage: string,
  model = OLLAMA_MODEL,
  timeoutMs = 60_000,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${OLLAMA_BASE_URL}/api/chat`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        stream: false,
        options: {
          temperature: 0,
          num_predict: 4096,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data?.message?.content;
    if (!text) {
      throw new Error(
        `Ollama: unexpected response shape — ${JSON.stringify(data).slice(0, 200)}`,
      );
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}
