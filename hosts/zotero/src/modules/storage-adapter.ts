/**
 * Storage Adapter - SQLite database for agent data
 *
 * SDK-CANDIDATE: 50% reusable
 * - StorageAdapter interface pattern: 100% reusable
 * - HOST-SPECIFIC: Zotero SQLite via Zotero.DB, database path
 */

import logger from "../utils/logger";

const DB_NAME = "zotagentlet.sqlite";

/**
 * Initialize the database
 */
export async function initDatabase(): Promise<void> {
  try {
    const dbPath = PathUtils.join(Zotero.DataDirectory.dir, DB_NAME);
    logger.info(`Initializing database at: ${dbPath}`);

    // Attach database to Zotero's connection
    await Zotero.DB.queryAsync(
      `ATTACH DATABASE '${dbPath.replace(/'/g, "''")}' AS zotagentlet`
    );

    // Create tables
    await createTables();

    addon.data.db = true;
    logger.info("Database initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize database:", error);
    throw error;
  }
}

/**
 * Create database tables
 */
async function createTables(): Promise<void> {
  // Agents table (Agentlet v0.5 format)
  await Zotero.DB.queryAsync(`
    CREATE TABLE IF NOT EXISTS zotagentlet.agents (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      manifest TEXT NOT NULL,
      agent_html TEXT,
      extracted_manifest TEXT,
      permissions TEXT,
      installed_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Agent storage table (key-value per agent)
  await Zotero.DB.queryAsync(`
    CREATE TABLE IF NOT EXISTS zotagentlet.agent_storage (
      agent_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (agent_id, key)
    )
  `);

  logger.debug("Database tables created");
}

/**
 * Storage API for agents
 */
export class AgentStorage {
  constructor(private agentId: string) {}

  async get(key: string): Promise<any> {
    const row = await Zotero.DB.valueQueryAsync(
      "SELECT value FROM zotagentlet.agent_storage WHERE agent_id = ? AND key = ?",
      [this.agentId, key]
    );
    return row ? JSON.parse(row) : undefined;
  }

  async set(key: string, value: any): Promise<void> {
    const json = JSON.stringify(value);
    await Zotero.DB.queryAsync(
      `INSERT OR REPLACE INTO zotagentlet.agent_storage (agent_id, key, value)
       VALUES (?, ?, ?)`,
      [this.agentId, key, json]
    );
  }

  async remove(key: string): Promise<void> {
    await Zotero.DB.queryAsync(
      "DELETE FROM zotagentlet.agent_storage WHERE agent_id = ? AND key = ?",
      [this.agentId, key]
    );
  }

  async clear(): Promise<void> {
    await Zotero.DB.queryAsync(
      "DELETE FROM zotagentlet.agent_storage WHERE agent_id = ?",
      [this.agentId]
    );
  }

  async keys(): Promise<string[]> {
    const rows = await Zotero.DB.columnQueryAsync(
      "SELECT key FROM zotagentlet.agent_storage WHERE agent_id = ?",
      [this.agentId]
    );
    return rows;
  }
}

/**
 * StorageAdapter - Manages storage for all agents
 * Used by BridgeHandler to provide per-agent storage
 */
export class StorageAdapter {
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    // Database is initialized by initDatabase()
    this.initialized = true;
  }

  close(): void {
    this.initialized = false;
  }

  async get(agentId: string, key: string): Promise<any> {
    const row = await Zotero.DB.valueQueryAsync(
      "SELECT value FROM zotagentlet.agent_storage WHERE agent_id = ? AND key = ?",
      [agentId, key]
    );
    return row ? JSON.parse(row) : undefined;
  }

  async set(agentId: string, key: string, value: any): Promise<void> {
    const json = JSON.stringify(value);
    await Zotero.DB.queryAsync(
      `INSERT OR REPLACE INTO zotagentlet.agent_storage (agent_id, key, value)
       VALUES (?, ?, ?)`,
      [agentId, key, json]
    );
  }

  async remove(agentId: string, key: string): Promise<void> {
    await Zotero.DB.queryAsync(
      "DELETE FROM zotagentlet.agent_storage WHERE agent_id = ? AND key = ?",
      [agentId, key]
    );
  }

  async clear(agentId: string): Promise<void> {
    await Zotero.DB.queryAsync(
      "DELETE FROM zotagentlet.agent_storage WHERE agent_id = ?",
      [agentId]
    );
  }

  async keys(agentId: string): Promise<string[]> {
    const rows = await Zotero.DB.columnQueryAsync(
      "SELECT key FROM zotagentlet.agent_storage WHERE agent_id = ?",
      [agentId]
    );
    return rows;
  }
}
