/**
 * VS Code Storage Adapter - Persistent key-value storage for agents
 *
 * HOST-SPECIFIC: Uses VS Code's ExtensionContext.globalState for persistence
 */

import * as vscode from "vscode";
import type { IStorageAdapter } from "../../types/agentlet";

/**
 * Prefix for all agent storage keys
 */
const STORAGE_PREFIX = "agentlet.storage";

/**
 * Build the storage key for a specific agent and key
 */
function buildKey(agentId: string, key: string): string {
  return `${STORAGE_PREFIX}.${agentId}.${key}`;
}

/**
 * Build the prefix for all keys of a specific agent
 */
function buildAgentPrefix(agentId: string): string {
  return `${STORAGE_PREFIX}.${agentId}.`;
}

/**
 * Storage adapter implementation for VS Code
 * Uses ExtensionContext.globalState for persistence
 */
export class VSCodeStorageAdapter implements IStorageAdapter {
  constructor(private context: vscode.ExtensionContext) {}

  async get(agentId: string, key: string): Promise<unknown> {
    const storageKey = buildKey(agentId, key);
    return this.context.globalState.get(storageKey);
  }

  async set(agentId: string, key: string, value: unknown): Promise<void> {
    const storageKey = buildKey(agentId, key);
    await this.context.globalState.update(storageKey, value);
  }

  async remove(agentId: string, key: string): Promise<void> {
    const storageKey = buildKey(agentId, key);
    await this.context.globalState.update(storageKey, undefined);
  }

  async clear(agentId: string): Promise<void> {
    const prefix = buildAgentPrefix(agentId);
    const allKeys = this.context.globalState.keys();

    // Remove all keys that belong to this agent
    const removePromises = allKeys
      .filter((key) => key.startsWith(prefix))
      .map((key) => this.context.globalState.update(key, undefined));

    await Promise.all(removePromises);
  }

  async keys(agentId: string): Promise<string[]> {
    const prefix = buildAgentPrefix(agentId);
    const allKeys = this.context.globalState.keys();

    // Filter and strip prefix to get just the key names
    return allKeys
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length));
  }
}
