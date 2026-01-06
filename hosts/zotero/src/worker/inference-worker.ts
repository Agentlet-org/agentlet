/**
 * Inference Worker - ChromeWorker for Transformers.js text generation
 *
 * Runs LLM inference off the main thread for agent requests.
 * Uses quantized models suitable for local execution.
 */

declare const self: any;
declare const postMessage: (data: any) => void;
declare const addEventListener: (
  type: string,
  handler: (event: any) => void
) => void;

// Set up globals that Transformers.js expects
(globalThis as any).self = globalThis;
(globalThis as any).window = globalThis;
if (typeof navigator === "undefined") {
  (globalThis as any).navigator = {
    userAgent: "Zotero ChromeWorker",
    hardwareConcurrency: 4,
    language: "en-US",
    languages: ["en-US", "en"],
  };
}

// Import Transformers.js v3
import { pipeline, env, TextGenerationPipeline } from "@huggingface/transformers";

// Configure WASM paths BEFORE any pipeline initialization
env.backends.onnx.wasm.wasmPaths = "chrome://zotagentlet/content/wasm/";

// Configure for local/bundled operation
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "chrome://zotagentlet/content/models/";

// Disable browser caching (not available in ChromeWorker)
env.useBrowserCache = false;
(env as any).useCache = false;

// Use multiple threads for faster inference
env.backends.onnx.wasm.numThreads = navigator.hardwareConcurrency || 4;

// Log configuration
postMessage({
  type: "log",
  level: "info",
  message: "Transformers.js v3 environment configured for inference",
  data: {
    wasmPaths: env.backends.onnx.wasm.wasmPaths,
    localModelPath: env.localModelPath,
  },
});

// Worker state
let generationPipeline: TextGenerationPipeline | null = null;
let isLoading = false;
let currentModelId: string | null = null;

// Default model - can be overridden via config
// Options:
// - Xenova/Phi-3-mini-4k-instruct-onnx-web (~2GB) - Best quality
// - Xenova/TinyLlama-1.1B-Chat-v1.0 (~600MB) - Faster, smaller
// - Xenova/Qwen2-0.5B-Instruct (~500MB) - Good balance
const DEFAULT_MODEL_ID = "Xenova/TinyLlama-1.1B-Chat-v1.0";

const MODEL_OPTIONS = {
  quantized: true,
  local_files_only: true,
};

// Generation defaults
const DEFAULT_MAX_NEW_TOKENS = 512;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TOP_P = 0.9;

/**
 * Initialize the text generation pipeline
 */
async function initPipeline(modelId?: string): Promise<boolean> {
  const targetModel = modelId || DEFAULT_MODEL_ID;

  // Already loaded with same model
  if (generationPipeline && currentModelId === targetModel) {
    return true;
  }

  // Already loading
  if (isLoading) {
    return false;
  }

  isLoading = true;
  const startTime = Date.now();

  postMessage({
    type: "log",
    level: "info",
    message: "Loading text generation model",
    data: { modelId: targetModel },
  });

  postMessage({
    type: "status",
    status: "loading",
    message: `Loading model ${targetModel}...`,
  });

  try {
    generationPipeline = (await pipeline(
      "text-generation",
      targetModel,
      MODEL_OPTIONS
    )) as TextGenerationPipeline;

    currentModelId = targetModel;
    const loadTime = Date.now() - startTime;

    postMessage({
      type: "log",
      level: "info",
      message: `Model loaded in ${loadTime}ms`,
      data: { modelId: targetModel, loadTimeMs: loadTime },
    });

    postMessage({
      type: "status",
      status: "ready",
      message: `Model loaded (${loadTime}ms)`,
    });

    return true;
  } catch (error: any) {
    const loadTime = Date.now() - startTime;

    postMessage({
      type: "log",
      level: "error",
      message: `Failed to load model after ${loadTime}ms`,
      data: {
        error: error.message || String(error),
        stack: error.stack,
      },
    });

    postMessage({
      type: "error",
      error: `Failed to load model: ${error.message}`,
    });

    return false;
  } finally {
    isLoading = false;
  }
}

/**
 * Format messages into a prompt string
 * Supports OpenAI-style message format
 */
function formatPrompt(
  messages: Array<{ role: string; content: string }>,
  system?: string
): string {
  // TinyLlama chat format
  let prompt = "";

  if (system) {
    prompt += `<|system|>\n${system}</s>\n`;
  }

  for (const msg of messages) {
    if (msg.role === "system") {
      prompt += `<|system|>\n${msg.content}</s>\n`;
    } else if (msg.role === "user") {
      prompt += `<|user|>\n${msg.content}</s>\n`;
    } else if (msg.role === "assistant") {
      prompt += `<|assistant|>\n${msg.content}</s>\n`;
    }
  }

  // Add assistant prefix for generation
  prompt += "<|assistant|>\n";

  return prompt;
}

/**
 * Generate text completion
 */
async function generateCompletion(
  jobId: string,
  request: {
    prompt?: string;
    messages?: Array<{ role: string; content: string }>;
    system?: string;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    stream?: boolean;
  }
): Promise<void> {
  if (!generationPipeline) {
    postMessage({
      type: "error",
      jobId,
      error: "Pipeline not initialized",
    });
    return;
  }

  try {
    const startTime = Date.now();

    // Build prompt from messages or use direct prompt
    let inputText: string;
    if (request.messages) {
      inputText = formatPrompt(request.messages, request.system);
    } else if (request.prompt) {
      inputText = request.system
        ? `<|system|>\n${request.system}</s>\n<|user|>\n${request.prompt}</s>\n<|assistant|>\n`
        : request.prompt;
    } else {
      throw new Error("Either prompt or messages must be provided");
    }

    const maxNewTokens = request.max_tokens || DEFAULT_MAX_NEW_TOKENS;
    const temperature = request.temperature ?? DEFAULT_TEMPERATURE;
    const topP = request.top_p ?? DEFAULT_TOP_P;

    postMessage({
      type: "log",
      level: "debug",
      message: "Starting generation",
      data: {
        jobId,
        inputLength: inputText.length,
        maxNewTokens,
        temperature,
      },
    });

    if (request.stream) {
      // Streaming generation
      await generateStreaming(jobId, inputText, maxNewTokens, temperature, topP);
    } else {
      // Non-streaming generation
      const output = await generationPipeline(inputText, {
        max_new_tokens: maxNewTokens,
        temperature,
        top_p: topP,
        do_sample: temperature > 0,
        return_full_text: false,
      });

      const generatedText = (output as any)[0]?.generated_text || "";
      const processingTime = Date.now() - startTime;

      postMessage({
        type: "log",
        level: "info",
        message: `Generation complete in ${processingTime}ms`,
        data: {
          jobId,
          outputLength: generatedText.length,
          processingTimeMs: processingTime,
        },
      });

      postMessage({
        type: "complete",
        jobId,
        result: generatedText,
        processingTimeMs: processingTime,
      });
    }
  } catch (error: any) {
    postMessage({
      type: "log",
      level: "error",
      message: "Generation failed",
      data: { jobId, error: error.message || String(error) },
    });

    postMessage({
      type: "error",
      jobId,
      error: error.message || String(error),
    });
  }
}

/**
 * Streaming text generation with token callbacks
 */
async function generateStreaming(
  jobId: string,
  inputText: string,
  maxNewTokens: number,
  temperature: number,
  topP: number
): Promise<void> {
  const startTime = Date.now();
  let fullText = "";

  try {
    // Use the pipeline with streaming callback
    const streamer = {
      put(tokens: number[]): void {
        // Note: actual streaming implementation depends on model/tokenizer
        // This is a simplified version
      },
      end(): void {
        // Stream ended
      },
    };

    // For models that support streaming via TextStreamer
    const output = await generationPipeline!(inputText, {
      max_new_tokens: maxNewTokens,
      temperature,
      top_p: topP,
      do_sample: temperature > 0,
      return_full_text: false,
      // callback_function for token-by-token streaming
      callback_function: (x: any) => {
        // Get the newly generated token
        if (x && x.output_token_ids) {
          // This depends on the specific model's output format
          // Most models return incremental tokens
        }
      },
    });

    fullText = (output as any)[0]?.generated_text || "";
    const processingTime = Date.now() - startTime;

    postMessage({
      type: "complete",
      jobId,
      result: fullText,
      processingTimeMs: processingTime,
    });
  } catch (error: any) {
    postMessage({
      type: "error",
      jobId,
      error: error.message || String(error),
    });
  }
}

/**
 * Handle messages from main thread
 */
addEventListener("message", async (event: MessageEvent) => {
  const { type, jobId, data } = event.data;

  switch (type) {
    case "init":
      await initPipeline(data?.modelId);
      break;

    case "inference":
      if (!generationPipeline) {
        const loaded = await initPipeline(data?.modelId);
        if (!loaded) {
          postMessage({
            type: "error",
            jobId,
            error: "Failed to initialize model",
          });
          return;
        }
      }
      await generateCompletion(jobId, data);
      break;

    case "status":
      postMessage({
        type: "status",
        jobId,
        status: generationPipeline ? "ready" : "not_initialized",
        modelId: currentModelId,
      });
      break;

    case "ping":
      postMessage({ type: "pong", jobId });
      break;

    default:
      postMessage({
        type: "error",
        jobId,
        error: `Unknown message type: ${type}`,
      });
  }
});

// Signal that worker script is loaded
postMessage({
  type: "log",
  level: "info",
  message: "Inference worker initialized",
  data: { defaultModel: DEFAULT_MODEL_ID },
});

postMessage({
  type: "status",
  status: "initialized",
  message: "Worker script loaded",
});
