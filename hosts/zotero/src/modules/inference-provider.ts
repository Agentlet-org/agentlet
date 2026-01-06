/**
 * Inference Provider - Manages LLM inference via Ollama or OpenAI
 *
 * Provides the inference API for agents running in the sandbox.
 * Uses fetch() to communicate with external inference providers.
 *
 * SDK-CANDIDATE: 80% reusable
 * - IInferenceProvider interface: 100% reusable
 * - InferenceRequest/Result interfaces: 100% reusable
 * - Ollama/OpenAI implementations: 100% reusable
 * - HOST-SPECIFIC: getPref() calls for settings
 */

import logger, { ztLog } from "../utils/logger";
import { getPref } from "../utils/prefs";
import { IInferenceProvider } from "../types/agentlet";

declare const Zotero: any;

/**
 * Strip markdown code fences from LLM responses
 * Handles: ```json ... ```, ``` ... ```, etc.
 */
function stripCodeFences(text: string): string {
  // Match ```language\n...\n``` or ```\n...\n```
  const fenceMatch = text.match(/^```(?:\w+)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return text.trim();
}

export interface InferenceRequest {
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
  system?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

export interface InferenceResult {
  text: string;
  processingTimeMs: number;
}

/**
 * InferenceProvider manages inference via Ollama or OpenAI
 */
export class InferenceProvider implements IInferenceProvider {
  private provider: "ollama" | "openai" = "ollama";

  /**
   * Check if inference is available
   */
  isAvailable(): boolean {
    const provider = getPref("inference.provider", "ollama") as string;
    if (provider === "openai") {
      const key = getPref("openai.key", "") as string;
      return key.length > 0;
    }
    // Ollama is always "available" - will fail at runtime if not running
    return true;
  }

  /**
   * Initialize the inference provider
   */
  async init(): Promise<void> {
    this.provider = getPref("inference.provider", "ollama") as "ollama" | "openai";
    ztLog(`[ZotAgentlet] Inference provider initialized: ${this.provider}\n`);
  }

  /**
   * Shutdown the provider
   */
  shutdown(): void {
    Zotero.debug("[ZotAgentlet] Inference provider shutdown");
  }

  /**
   * Run inference (non-streaming)
   */
  async inference(request: InferenceRequest): Promise<string> {
    const provider = getPref("inference.provider", "ollama") as string;

    if (provider === "openai") {
      return this._openaiInference(request);
    } else {
      return this._ollamaInference(request);
    }
  }

  /**
   * Run streaming inference with token callback
   */
  async streamingInference(
    request: InferenceRequest,
    onToken: (token: string) => void
  ): Promise<string> {
    const provider = getPref("inference.provider", "ollama") as string;

    if (provider === "openai") {
      return this._openaiStreamingInference(request, onToken);
    } else {
      return this._ollamaStreamingInference(request, onToken);
    }
  }

  /**
   * Ollama inference (non-streaming)
   */
  private async _ollamaInference(request: InferenceRequest): Promise<string> {
    const url = getPref("ollama.url", "http://localhost:11434") as string;
    const model = getPref("ollama.model", "llama3.2") as string;

    const messages = this._buildMessages(request);

    const requestBody = {
      model,
      messages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.7,
        top_p: request.top_p,
        num_predict: request.max_tokens,
      },
    };

    ztLog(`[ZotAgentlet] Inference - Ollama request to ${url}/api/chat\n`);
    ztLog(`[ZotAgentlet] Inference - Model: ${model}\n`);
    ztLog(`[ZotAgentlet] Inference - Messages: ${JSON.stringify(messages)}\n`);

    const response = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const text = await response.text();
      ztLog(`[ZotAgentlet] Inference - Ollama error: ${response.status} ${text}\n`);
      throw new Error(`Ollama error: ${response.status} ${text}\n`);
    }

    const data = await response.json();
    const rawResult = data.message?.content || "";
    const result = stripCodeFences(rawResult);

    ztLog(`[ZotAgentlet] Inference - Ollama response: ${result}\n`);

    return result;
  }

  /**
   * Ollama streaming inference
   */
  private async _ollamaStreamingInference(
    request: InferenceRequest,
    onToken: (token: string) => void
  ): Promise<string> {
    const url = getPref("ollama.url", "http://localhost:11434") as string;
    const model = getPref("ollama.model", "llama3.2") as string;

    const messages = this._buildMessages(request);

    const response = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: {
          temperature: request.temperature ?? 0.7,
          top_p: request.top_p,
          num_predict: request.max_tokens,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama error: ${response.status} ${text}\n`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            fullText += data.message.content;
            onToken(data.message.content);
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }

    return fullText;
  }

  /**
   * OpenAI inference (non-streaming)
   */
  private async _openaiInference(request: InferenceRequest): Promise<string> {
    const apiKey = getPref("openai.key", "") as string;
    const model = getPref("openai.model", "gpt-4o-mini") as string;

    if (!apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const messages = this._buildMessages(request);

    ztLog(`[ZotAgentlet] Inference - OpenAI request\n`);
    ztLog(`[ZotAgentlet] Inference - Model: ${model}\n`);
    ztLog(`[ZotAgentlet] Inference - Messages: ${JSON.stringify(messages)}\n`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: request.temperature ?? 0.7,
        top_p: request.top_p,
        max_tokens: request.max_tokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      ztLog(`[ZotAgentlet] Inference - OpenAI error: ${response.status} ${text}\n`);
      throw new Error(`OpenAI error: ${response.status} ${text}\n`);
    }

    const data = await response.json();
    const rawResult = data.choices?.[0]?.message?.content || "";
    const result = stripCodeFences(rawResult);

    ztLog(`[ZotAgentlet] Inference - OpenAI response: ${result}\n`);

    return result;
  }

  /**
   * OpenAI streaming inference
   */
  private async _openaiStreamingInference(
    request: InferenceRequest,
    onToken: (token: string) => void
  ): Promise<string> {
    const apiKey = getPref("openai.key", "") as string;
    const model = getPref("openai.model", "gpt-4o-mini") as string;

    if (!apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const messages = this._buildMessages(request);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: request.temperature ?? 0.7,
        top_p: request.top_p,
        max_tokens: request.max_tokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI error: ${response.status} ${text}\n`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter(line => line.startsWith("data: "));

      for (const line of lines) {
        const data = line.slice(6); // Remove "data: " prefix
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            onToken(content);
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    return fullText;
  }

  /**
   * Build messages array from request
   */
  private _buildMessages(request: InferenceRequest): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    // Add system message if provided
    if (request.system) {
      messages.push({ role: "system", content: request.system });
    }

    // Add conversation messages if provided
    if (request.messages?.length) {
      messages.push(...request.messages);
    }
    // Or add simple prompt as user message
    else if (request.prompt) {
      messages.push({ role: "user", content: request.prompt });
    }

    return messages;
  }
}

// Singleton instance
let inferenceProvider: InferenceProvider | null = null;

/**
 * Get or create the inference provider
 */
export function getInferenceProvider(): InferenceProvider {
  if (!inferenceProvider) {
    inferenceProvider = new InferenceProvider();
  }
  return inferenceProvider;
}

/**
 * Initialize inference
 */
export async function initInference(): Promise<void> {
  const provider = getInferenceProvider();
  await provider.init();
}

/**
 * Shutdown inference
 */
export function shutdownInference(): void {
  if (inferenceProvider) {
    inferenceProvider.shutdown();
    inferenceProvider = null;
  }
}
