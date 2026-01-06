/**
 * Obsidian Intent Handler - Implements standard intents for Obsidian
 *
 * HOST-SPECIFIC: All intent implementations use Obsidian's APIs
 */

import { App, TFile } from "obsidian";
import { IIntentHandler, IContextAdapter, ErrorCodes } from "../../types/agentlet";

/**
 * Intent handler implementation for Obsidian
 * Handles add-tags, remove-tags, move-to, link, unlink, create, update, delete, search, open
 */
export class ObsidianIntentHandler implements IIntentHandler {
  constructor(private app: App, private contextAdapter: IContextAdapter) {}

  async execute(
    intent: string,
    items: any[],
    params: any
  ): Promise<{ success: boolean; affected: number; result?: any }> {
    let affected = 0;
    let result: any;

    try {
      switch (intent) {
        case "add-tags": {
          const { tags } = params;
          if (!tags || !Array.isArray(tags)) {
            throw this.error(
              ErrorCodes.CONTEXT_VALIDATION_FAILED,
              "Tags array required"
            );
          }
          for (const item of items) {
            const file = this.app.vault.getAbstractFileByPath(
              item.id || item.path
            );
            if (file instanceof TFile) {
              await this.app.fileManager.processFrontMatter(file, (fm) => {
                const existing = fm.tags || [];
                const normalizedNew = tags.map((t: string) =>
                  t.startsWith("#") ? t.slice(1) : t
                );
                fm.tags = [...new Set([...existing, ...normalizedNew])];
              });
              affected++;
            }
          }
          break;
        }

        case "remove-tags": {
          const { tags } = params;
          if (!tags || !Array.isArray(tags)) {
            throw this.error(
              ErrorCodes.CONTEXT_VALIDATION_FAILED,
              "Tags array required"
            );
          }
          const tagsToRemove = new Set(
            tags.map((t: string) => (t.startsWith("#") ? t.slice(1) : t))
          );
          for (const item of items) {
            const file = this.app.vault.getAbstractFileByPath(
              item.id || item.path
            );
            if (file instanceof TFile) {
              await this.app.fileManager.processFrontMatter(file, (fm) => {
                fm.tags = (fm.tags || []).filter(
                  (t: string) => !tagsToRemove.has(t)
                );
              });
              affected++;
            }
          }
          break;
        }

        case "move-to": {
          const { destination } = params;
          if (!destination) {
            throw this.error(
              ErrorCodes.CONTEXT_VALIDATION_FAILED,
              "Destination required"
            );
          }

          // Ensure destination folder exists
          const destFolder = this.app.vault.getAbstractFileByPath(destination);
          if (!destFolder) {
            await this.app.vault.createFolder(destination);
          }

          for (const item of items) {
            const file = this.app.vault.getAbstractFileByPath(
              item.id || item.path
            );
            if (file instanceof TFile) {
              const newPath = `${destination}/${file.name}`;
              await this.app.vault.rename(file, newPath);
              affected++;
            }
          }
          break;
        }

        case "link": {
          const { from, to } = params;
          if (!from || !to) {
            throw this.error(
              ErrorCodes.CONTEXT_VALIDATION_FAILED,
              "Both from and to required"
            );
          }

          const fromFile = this.app.vault.getAbstractFileByPath(
            from.id || from.path || from
          );
          const toFile = this.app.vault.getAbstractFileByPath(
            to.id || to.path || to
          );

          if (fromFile instanceof TFile && toFile instanceof TFile) {
            const content = await this.app.vault.read(fromFile);
            const link = `[[${toFile.basename}]]`;
            if (!content.includes(link)) {
              await this.app.vault.modify(fromFile, content + `\n\n${link}`);
            }
            affected = 1;
          }
          break;
        }

        case "unlink": {
          const { from, to } = params;
          if (!from || !to) {
            throw this.error(
              ErrorCodes.CONTEXT_VALIDATION_FAILED,
              "Both from and to required"
            );
          }

          const fromFile = this.app.vault.getAbstractFileByPath(
            from.id || from.path || from
          );
          const toFile = this.app.vault.getAbstractFileByPath(
            to.id || to.path || to
          );

          if (fromFile instanceof TFile && toFile instanceof TFile) {
            let content = await this.app.vault.read(fromFile);
            // Remove wiki-style links
            const patterns = [
              new RegExp(`\\[\\[${toFile.basename}\\]\\]`, "g"),
              new RegExp(`\\[\\[${toFile.basename}\\|[^\\]]+\\]\\]`, "g"),
            ];
            for (const pattern of patterns) {
              content = content.replace(pattern, "");
            }
            await this.app.vault.modify(fromFile, content);
            affected = 1;
          }
          break;
        }

        case "create": {
          const { type = "note", data } = params;
          result = await this.contextAdapter.create(type, data);
          affected = 1;
          break;
        }

        case "update": {
          const { fields } = params;
          if (!fields) {
            throw this.error(
              ErrorCodes.CONTEXT_VALIDATION_FAILED,
              "Fields object required"
            );
          }
          for (const item of items) {
            await this.contextAdapter.update(
              "note",
              item.id || item.path,
              fields
            );
            affected++;
          }
          break;
        }

        case "delete": {
          for (const item of items) {
            await this.contextAdapter.delete("note", item.id || item.path);
            affected++;
          }
          break;
        }

        case "search": {
          const { query } = params;
          if (!query) {
            throw this.error(
              ErrorCodes.CONTEXT_VALIDATION_FAILED,
              "Query required"
            );
          }
          result = await this.contextAdapter.query("note", { search: query });
          affected = result.length;
          break;
        }

        case "open": {
          for (const item of items) {
            const file = this.app.vault.getAbstractFileByPath(
              item.id || item.path
            );
            if (file instanceof TFile) {
              await this.app.workspace.openLinkText(file.path, "", false);
              affected++;
              break; // Only open first item
            }
          }
          break;
        }

        default:
          throw this.error(
            ErrorCodes.INTENT_NOT_SUPPORTED,
            `Intent not supported: ${intent}`
          );
      }

      return { success: true, affected, result };
    } catch (error: any) {
      if (error.code) throw error;
      throw this.error(
        ErrorCodes.ACT_FAILED,
        error.message || `Failed to execute intent: ${intent}`
      );
    }
  }

  private error(code: string, message: string): Error {
    const error = new Error(message);
    (error as any).code = code;
    return error;
  }
}
