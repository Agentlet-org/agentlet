/**
 * VS Code Inference Provider - LLM inference via Ollama or OpenAI
 *
 * Supports local Ollama and cloud OpenAI with automatic fallback.
 */

import * as vscode from "vscode";
import type { IInferenceProvider } from "../../types/agentlet";

/**
 * Inference request format
 */
interface InferenceRequest {
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
  system?: string;
}

/**
 * Inference provider implementation for VS Code
 * Supports Ollama (local) and OpenAI (cloud)
 */
export class VSCodeInferenceProvider implements IInferenceProvider {
  private ollamaAvailable: boolean | null = null;
  private openaiKey: string | null = null;

  constructor() {
    // Check availability on first use
  }

  /**
   * Check if any inference provider is available
   */
  isAvailable(): boolean {
    // Always return true - we'll check on first call
    // This allows the extension to load without blocking
    return true;
  }

  /**
   * Perform inference
   */
  async inference(request: unknown): Promise<unknown> {
    const req = request as InferenceRequest;
    console.log("[Agentlet] inference() called");

    // Try Ollama first (local, private)
    console.log("[Agentlet] Trying Ollama...");
    const ollamaResult = await this.tryOllama(req);
    if (ollamaResult !== null) {
      console.log("[Agentlet] Ollama succeeded");
      return ollamaResult;
    }
    console.log("[Agentlet] Ollama failed or skipped, trying OpenAI...");

    // Fall back to OpenAI
    const openaiResult = await this.tryOpenAI(req);
    if (openaiResult !== null) {
      console.log("[Agentlet] OpenAI succeeded");
      return openaiResult;
    }

    console.log("[Agentlet] All inference providers failed");
    throw new Error(
      "No inference provider available. Configure Ollama or OpenAI in settings."
    );
  }

  /**
   * Streaming inference
   */
  async streamingInference(
    request: unknown,
    onToken: (token: string) => void
  ): Promise<string> {
    const req = request as InferenceRequest;

    // Try Ollama first
    const ollamaResult = await this.tryOllamaStreaming(req, onToken);
    if (ollamaResult !== null) {
      return ollamaResult;
    }

    // Fall back to OpenAI
    const openaiResult = await this.tryOpenAIStreaming(req, onToken);
    if (openaiResult !== null) {
      return openaiResult;
    }

    throw new Error(
      "No streaming inference provider available."
    );
  }

  // ═══ OLLAMA ═══

  /**
   * Try Ollama for inference
   */
  private async tryOllama(req: InferenceRequest): Promise<string | null> {
    const config = vscode.workspace.getConfiguration("agentlet.inference");
    const provider = config.get<string>("provider", "ollama");

    if (provider !== "ollama") {
      return null;
    }

    const ollamaUrl = config.get<string>("ollamaUrl", "http://localhost:11434");
    const model = config.get<string>("ollamaModel", "llama3.2");

    try {
      const messages = this.buildMessages(req);

      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            num_predict: req.max_tokens || 1024,
            temperature: req.temperature || 0.7,
          },
        }),
      });

      if (!response.ok) {
        this.ollamaAvailable = false;
        return null;
      }

      this.ollamaAvailable = true;
      const data = await response.json() as { message?: { content?: string } };
      return data.message?.content || "";
    } catch {
      this.ollamaAvailable = false;
      return null;
    }
  }

  /**
   * Try Ollama for streaming inference
   */
  private async tryOllamaStreaming(
    req: InferenceRequest,
    onToken: (token: string) => void
  ): Promise<string | null> {
    const config = vscode.workspace.getConfiguration("agentlet.inference");
    const provider = config.get<string>("provider", "ollama");

    if (provider !== "ollama") {
      return null;
    }

    const ollamaUrl = config.get<string>("ollamaUrl", "http://localhost:11434");
    const model = config.get<string>("ollamaModel", "llama3.2");

    try {
      const messages = this.buildMessages(req);

      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          options: {
            num_predict: req.max_tokens || 1024,
            temperature: req.temperature || 0.7,
          },
        }),
      });

      if (!response.ok || !response.body) {
        return null;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line) as { message?: { content?: string } };
            const content = data.message?.content || "";
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
    } catch {
      return null;
    }
  }

  // ═══ OPENAI ═══

  /**
   * Try OpenAI for inference
   */
  private async tryOpenAI(req: InferenceRequest): Promise<string | null> {
    const config = vscode.workspace.getConfiguration("agentlet.inference");
    const provider = config.get<string>("provider", "ollama");

    console.log("[Agentlet] tryOpenAI called, provider:", provider, "ollamaAvailable:", this.ollamaAvailable);

    // Only use OpenAI if explicitly configured or as fallback
    if (provider !== "openai" && this.ollamaAvailable !== false) {
      console.log("[Agentlet] Skipping OpenAI (provider not openai and ollama not failed)");
      return null;
    }

    // Get API key from secrets or settings
    const apiKey = await this.getOpenAIKey();
    if (!apiKey) {
      console.log("[Agentlet] No OpenAI API key found");
      return null;
    }

    const model = config.get<string>("openaiModel", "gpt-4o-mini");
    console.log("[Agentlet] Calling OpenAI with model:", model);

    try {
      const messages = this.buildMessages(req);
      console.log("[Agentlet] OpenAI messages count:", messages.length);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: req.max_tokens || 1024,
          temperature: req.temperature || 0.7,
        }),
      });

      console.log("[Agentlet] OpenAI response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log("[Agentlet] OpenAI error:", errorText);
        return null;
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const result = data.choices?.[0]?.message?.content || "";
      console.log("[Agentlet] OpenAI response length:", result.length);
      return result;
    } catch (error) {
      console.error("[Agentlet] OpenAI exception:", error);
      return null;
    }
  }

  /**
   * Try OpenAI for streaming inference
   */
  private async tryOpenAIStreaming(
    req: InferenceRequest,
    onToken: (token: string) => void
  ): Promise<string | null> {
    const config = vscode.workspace.getConfiguration("agentlet.inference");
    const provider = config.get<string>("provider", "ollama");

    if (provider !== "openai" && this.ollamaAvailable !== false) {
      return null;
    }

    const apiKey = await this.getOpenAIKey();
    if (!apiKey) {
      return null;
    }

    const model = config.get<string>("openaiModel", "gpt-4o-mini");

    try {
      const messages = this.buildMessages(req);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: req.max_tokens || 1024,
          temperature: req.temperature || 0.7,
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        return null;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk
          .split("\n")
          .filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"));

        for (const line of lines) {
          try {
            const json = line.slice(6);
            const data = JSON.parse(json) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const content = data.choices?.[0]?.delta?.content || "";
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
    } catch {
      return null;
    }
  }

  // ═══ HELPERS ═══

  /**
   * Build messages array from request
   */
  private buildMessages(
    req: InferenceRequest
  ): Array<{ role: string; content: string }> {
    if (req.messages) {
      // Add system message if provided separately
      if (req.system) {
        return [{ role: "system", content: req.system }, ...req.messages];
      }
      return req.messages;
    }

    // Build from prompt
    const messages: Array<{ role: string; content: string }> = [];

    if (req.system) {
      messages.push({ role: "system", content: req.system });
    }

    if (req.prompt) {
      messages.push({ role: "user", content: req.prompt });
    }

    return messages;
  }

  /**
   * Get OpenAI API key from settings or environment
   */
  private async getOpenAIKey(): Promise<string | null> {
    if (this.openaiKey) {
      return this.openaiKey;
    }

    // Try VS Code settings first
    const config = vscode.workspace.getConfiguration("agentlet.inference");
    const settingsKey = config.get<string>("openaiApiKey", "");
    if (settingsKey) {
      this.openaiKey = settingsKey;
      return settingsKey;
    }

    // Try environment variable
    const envKey = process.env.OPENAI_API_KEY;
    if (envKey) {
      this.openaiKey = envKey;
      return envKey;
    }

    return null;
  }
}
