/**
 * Zotero Intent Handler - Implements intent execution for adaptive agents
 *
 * Extracts the intent execution logic from BridgeHandler into a reusable
 * component that implements the SDK's IIntentHandler interface.
 *
 * NOTE: This handler does NOT check context permissions because:
 * 1. Adaptive agents use perceive()/act() APIs which are higher-level
 * 2. Having the "act" capability is sufficient authorization
 * 3. The supported intents list controls what actions are allowed
 * 4. Direct context API (context.query, etc.) still requires permissions
 */

import type { IIntentHandler, IContextAdapter, ActResult } from "../../types/agentlet";
import { ErrorCodes } from "@agentlet/host-sdk";

/**
 * Helper to create an error with code
 */
function createError(code: string, message: string): Error {
  const error = new Error(message);
  (error as Error & { code: string }).code = code;
  return error;
}

/**
 * Zotero Intent Handler
 *
 * Executes intents on Zotero items. Supports:
 * - add-tags: Add tags to items
 * - remove-tags: Remove tags from items
 * - move-to: Move items to a collection
 * - create: Create new items
 * - update: Update item fields
 * - delete: Delete items
 * - search: Search for items
 * - open: Open/focus items
 */
export class ZoteroIntentHandler implements IIntentHandler {
  constructor(private contextAdapter: IContextAdapter) {}

  async execute(
    intent: string,
    items: unknown[],
    params: unknown
  ): Promise<ActResult> {
    const p = params as Record<string, unknown>;
    let affected = 0;
    let result: unknown;

    switch (intent) {
      case "add-tags": {
        const { tags } = p;
        if (!tags || !Array.isArray(tags)) {
          throw createError(
            ErrorCodes.CONTEXT_VALIDATION_FAILED,
            "Tags array is required for add-tags intent"
          );
        }
        for (const item of items) {
          const i = item as Record<string, unknown>;
          const existingTags = (i.tags as Array<{ tag: string } | string>) || [];
          const newTags = [
            ...new Set([
              ...existingTags.map((t) => (typeof t === "string" ? t : t.tag)),
              ...(tags as string[]),
            ]),
          ];
          await this.contextAdapter.update("bibliographic", i.id as number, {
            tags: newTags,
          });
          affected++;
        }
        break;
      }

      case "remove-tags": {
        const { tags } = p;
        if (!tags || !Array.isArray(tags)) {
          throw createError(
            ErrorCodes.CONTEXT_VALIDATION_FAILED,
            "Tags array is required for remove-tags intent"
          );
        }
        const tagsToRemove = new Set(tags as string[]);
        for (const item of items) {
          const i = item as Record<string, unknown>;
          const existingTags = ((i.tags as Array<{ tag: string } | string>) || []).map(
            (t) => (typeof t === "string" ? t : t.tag)
          );
          const filteredTags = existingTags.filter((t) => !tagsToRemove.has(t));
          await this.contextAdapter.update("bibliographic", i.id as number, {
            tags: filteredTags,
          });
          affected++;
        }
        break;
      }

      case "move-to": {
        const { destination } = p;
        if (!destination) {
          throw createError(
            ErrorCodes.CONTEXT_VALIDATION_FAILED,
            "Destination is required for move-to intent"
          );
        }
        // Find or create the collection
        const collections = await this.contextAdapter.query("collection", {
          name: destination,
        });
        let collectionId: number;
        if (collections.length > 0) {
          collectionId = (collections[0] as Record<string, unknown>).id as number;
        } else {
          const newCollection = (await this.contextAdapter.create("collection", {
            name: destination,
          })) as Record<string, unknown>;
          collectionId = newCollection.id as number;
        }
        // Add items to collection
        for (const item of items) {
          const i = item as Record<string, unknown>;
          await this.contextAdapter.update("bibliographic", i.id as number, {
            collections: [collectionId],
          });
          affected++;
        }
        break;
      }

      case "create": {
        const { type = "note", data } = p;
        result = await this.contextAdapter.create(
          type === "note" ? "bibliographic" : (type as string),
          data
        );
        affected = 1;
        break;
      }

      case "update": {
        const { fields } = p;
        if (!fields) {
          throw createError(
            ErrorCodes.CONTEXT_VALIDATION_FAILED,
            "Fields object is required for update intent"
          );
        }
        for (const item of items) {
          const i = item as Record<string, unknown>;
          await this.contextAdapter.update("bibliographic", i.id as number, fields);
          affected++;
        }
        break;
      }

      case "delete": {
        for (const item of items) {
          const i = item as Record<string, unknown>;
          await this.contextAdapter.delete("bibliographic", i.id as number);
          affected++;
        }
        break;
      }

      case "search": {
        const { query } = p;
        if (!query) {
          throw createError(
            ErrorCodes.CONTEXT_VALIDATION_FAILED,
            "Query is required for search intent"
          );
        }
        result = await this.contextAdapter.query("bibliographic", { search: query });
        affected = (result as unknown[]).length;
        break;
      }

      case "open": {
        // Open items in Zotero - this would focus/select them
        // For now just acknowledge the intent
        affected = items.length;
        break;
      }

      default:
        throw createError(
          ErrorCodes.INTENT_NOT_SUPPORTED,
          `Intent '${intent}' is not implemented`
        );
    }

    return {
      success: true,
      affected,
      result,
    };
  }
}
