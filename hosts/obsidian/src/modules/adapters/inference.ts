/**
 * Obsidian Inference Provider - LLM inference for agents
 *
 * HOST-SPECIFIC: Uses fetch for Ollama/OpenAI API calls
 * Follows privacy-first approach: try Ollama (local) first, then OpenAI
 */

import { IInferenceProvider, InferenceSettings } from "../../types/agentlet";

/**
 * Inference provider implementation for Obsidian
 * Supports Ollama (local, privacy-first default) and OpenAI (fallback)
 */
export class ObsidianInferenceProvider implements IInferenceProvider {
  constructor(private settings: InferenceSettings) {}

  isAvailable(): boolean {
    return !!(this.settings.ollamaUrl || this.settings.openaiKey);
  }

  async inference(request: any): Promise<string> {
    // Try Ollama first (privacy-first default)
    if (this.settings.ollamaUrl) {
      try {
        return await this.ollamaInference(request);
      } catch (error) {
        console.warn("[Agentlet] Ollama inference failed, trying OpenAI:", error);
        // Fall through to OpenAI if Ollama fails
      }
    }

    // Try OpenAI
    if (this.settings.openaiKey) {
      return await this.openaiInference(request);
    }

    throw new Error(
      "No inference provider configured. Set up Ollama or OpenAI in settings."
    );
  }

  private async ollamaInference(request: any): Promise<string> {
    const prompt = request.prompt || this.messagesToPrompt(request.messages);

    const response = await fetch(`${this.settings.ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.settings.ollamaModel || "llama2",
        prompt,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.max_tokens ?? 1000,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  }

  private async openaiInference(request: any): Promise<string> {
    const messages = request.messages || [
      { role: "user", content: request.prompt },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.openaiKey}`,
      },
      body: JSON.stringify({
        model: this.settings.openaiModel || "gpt-4",
        messages,
        max_tokens: request.max_tokens || 1000,
        temperature: request.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI error: ${error.error?.message || response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private messagesToPrompt(messages: any[]): string {
    if (!messages) return "";
    return messages.map((m: any) => `${m.role}: ${m.content}`).join("\n\n");
  }
}
