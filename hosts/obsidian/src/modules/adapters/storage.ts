/**
 * Obsidian Storage Adapter - Persistent key-value storage for agents
 *
 * HOST-SPECIFIC: Uses Obsidian's plugin data storage (loadData/saveData)
 */

import { Plugin } from "obsidian";
import { IStorageAdapter } from "../../types/agentlet";

/**
 * Storage adapter implementation for Obsidian
 * Uses plugin.loadData/saveData for persistence
 */
export class ObsidianStorageAdapter implements IStorageAdapter {
  private data: Record<string, Record<string, any>> = {};
  private loaded = false;

  constructor(private plugin: Plugin) {}

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    const saved = await this.plugin.loadData();
    this.data = saved?.agentStorage || {};
    this.loaded = true;
  }

  private async saveData(): Promise<void> {
    const existing = (await this.plugin.loadData()) || {};
    await this.plugin.saveData({
      ...existing,
      agentStorage: this.data,
    });
  }

  async get(agentId: string, key: string): Promise<any> {
    await this.ensureLoaded();
    return this.data[agentId]?.[key];
  }

  async set(agentId: string, key: string, value: any): Promise<void> {
    await this.ensureLoaded();

    if (!this.data[agentId]) {
      this.data[agentId] = {};
    }
    this.data[agentId][key] = value;
    await this.saveData();
  }

  async remove(agentId: string, key: string): Promise<void> {
    await this.ensureLoaded();

    if (this.data[agentId]) {
      delete this.data[agentId][key];
      await this.saveData();
    }
  }

  async clear(agentId: string): Promise<void> {
    await this.ensureLoaded();

    delete this.data[agentId];
    await this.saveData();
  }

  async keys(agentId: string): Promise<string[]> {
    await this.ensureLoaded();
    return Object.keys(this.data[agentId] || {});
  }
}
