// ZotAgentlet default preferences

// General settings
pref("extensions.zotero.__addonRef__.debug", false);

// Inference provider selection: "ollama" or "openai"
pref("extensions.zotero.__addonRef__.inference.provider", "ollama");

// Ollama settings
pref("extensions.zotero.__addonRef__.ollama.url", "http://localhost:11434");
pref("extensions.zotero.__addonRef__.ollama.model", "llama3.2");

// OpenAI settings
pref("extensions.zotero.__addonRef__.openai.key", "");
pref("extensions.zotero.__addonRef__.openai.model", "gpt-4o-mini");

// Resource limits (per agent action invocation)
pref("extensions.zotero.__addonRef__.limits.maxExecutionTime", 300000);
pref("extensions.zotero.__addonRef__.limits.maxInferenceCalls", 100);
pref("extensions.zotero.__addonRef__.limits.maxNetworkRequests", 50);
pref("extensions.zotero.__addonRef__.limits.maxStorageBytes", 5242880);

// Auto-update agents
pref("extensions.zotero.__addonRef__.autoUpdateAgents", false);
