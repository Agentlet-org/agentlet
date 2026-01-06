/**
 * VS Code Intent Handler - Execute file and editor operations
 *
 * Handles standard intents like create, update, delete, open, etc.
 */

import * as vscode from "vscode";
import type { IIntentHandler, ActResult } from "../../types/agentlet";

/**
 * Intent handler implementation for VS Code
 */
export class VSCodeIntentHandler implements IIntentHandler {
  /**
   * Execute an intent
   */
  async execute(
    intent: string,
    items: unknown[],
    params: unknown
  ): Promise<ActResult> {
    const p = params as Record<string, unknown>;

    switch (intent) {
      case "create":
        return this.handleCreate(p);
      case "update":
        return this.handleUpdate(items, p);
      case "delete":
        return this.handleDelete(items);
      case "move-to":
        return this.handleMoveTo(items, p);
      case "copy-to":
        return this.handleCopyTo(items, p);
      case "search":
        return this.handleSearch(p);
      case "open":
        return this.handleOpen(items);
      case "replace-selection":
        return this.handleReplaceSelection(p);
      case "git-commit":
        return this.handleGitCommit(p);
      default:
        return { success: false, affected: 0 };
    }
  }

  /**
   * Create a new file
   */
  private async handleCreate(
    params: Record<string, unknown>
  ): Promise<ActResult> {
    const path = params.path as string;
    const content = (params.content as string) || "";

    if (!path) {
      throw new Error("Path is required for create intent");
    }

    // Resolve relative path against workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const rootUri = workspaceFolders?.[0]?.uri;

    const uri = path.startsWith("/")
      ? vscode.Uri.file(path)
      : rootUri
        ? vscode.Uri.joinPath(rootUri, path)
        : vscode.Uri.file(path);

    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(uri, encoder.encode(content));

    return { success: true, affected: 1, result: { path: uri.fsPath } };
  }

  /**
   * Update file content
   */
  private async handleUpdate(
    items: unknown[],
    params: Record<string, unknown>
  ): Promise<ActResult> {
    const content = params.content as string;
    const fields = params.fields as Record<string, unknown>;
    let affected = 0;

    for (const item of items) {
      const i = item as Record<string, unknown>;
      const path = i.path as string;

      if (!path) continue;

      const uri = vscode.Uri.file(path);
      const doc = await vscode.workspace.openTextDocument(uri);

      const edit = new vscode.WorkspaceEdit();

      if (content !== undefined) {
        // Replace entire content
        const fullRange = new vscode.Range(
          doc.positionAt(0),
          doc.positionAt(doc.getText().length)
        );
        edit.replace(uri, fullRange, content);
      } else if (fields) {
        // Structured field updates not supported for plain files
        throw new Error("Structured field updates not supported for files. Use content parameter instead.");
      }

      await vscode.workspace.applyEdit(edit);
      affected++;
    }

    return { success: true, affected };
  }

  /**
   * Delete files
   */
  private async handleDelete(items: unknown[]): Promise<ActResult> {
    let affected = 0;

    for (const item of items) {
      const i = item as Record<string, unknown>;
      const path = i.path as string;

      if (!path) continue;

      const uri = vscode.Uri.file(path);
      await vscode.workspace.fs.delete(uri);
      affected++;
    }

    return { success: true, affected };
  }

  /**
   * Move files to new location
   */
  private async handleMoveTo(
    items: unknown[],
    params: Record<string, unknown>
  ): Promise<ActResult> {
    const destination = params.destination as string;
    if (!destination) {
      throw new Error("Destination is required for move-to intent");
    }

    let affected = 0;

    for (const item of items) {
      const i = item as Record<string, unknown>;
      const path = i.path as string;

      if (!path) continue;

      const sourceUri = vscode.Uri.file(path);
      const fileName = path.split("/").pop() || "";
      const destUri = vscode.Uri.file(`${destination}/${fileName}`);

      await vscode.workspace.fs.rename(sourceUri, destUri);
      affected++;
    }

    return { success: true, affected };
  }

  /**
   * Copy files to new location
   */
  private async handleCopyTo(
    items: unknown[],
    params: Record<string, unknown>
  ): Promise<ActResult> {
    const destination = params.destination as string;
    if (!destination) {
      throw new Error("Destination is required for copy-to intent");
    }

    let affected = 0;

    for (const item of items) {
      const i = item as Record<string, unknown>;
      const path = i.path as string;

      if (!path) continue;

      const sourceUri = vscode.Uri.file(path);
      const fileName = path.split("/").pop() || "";
      const destUri = vscode.Uri.file(`${destination}/${fileName}`);

      await vscode.workspace.fs.copy(sourceUri, destUri);
      affected++;
    }

    return { success: true, affected };
  }

  /**
   * Search for files
   */
  private async handleSearch(
    params: Record<string, unknown>
  ): Promise<ActResult> {
    const query = params.query as string;
    const pattern = params.pattern as string;
    const limit = (params.limit as number) || 100;

    let files: vscode.Uri[];

    if (pattern) {
      // File pattern search
      files = await vscode.workspace.findFiles(pattern, undefined, limit);
    } else if (query) {
      // Text content search
      const locations = await vscode.commands.executeCommand<vscode.Location[]>(
        "vscode.executeWorkspaceSymbolProvider",
        query
      );

      files = (locations || []).map((l) => l.uri).slice(0, limit);
    } else {
      return { success: false, affected: 0 };
    }

    return {
      success: true,
      affected: files.length,
      result: files.map((f) => ({ path: f.fsPath })),
    };
  }

  /**
   * Open files in editor
   */
  private async handleOpen(items: unknown[]): Promise<ActResult> {
    let affected = 0;

    for (const item of items) {
      const i = item as Record<string, unknown>;
      const path = i.path as string;

      if (!path) continue;

      const uri = vscode.Uri.file(path);
      await vscode.window.showTextDocument(uri);
      affected++;
    }

    return { success: true, affected };
  }

  /**
   * Replace selected text in active editor
   */
  private async handleReplaceSelection(
    params: Record<string, unknown>
  ): Promise<ActResult> {
    const content = params.content as string;
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      throw new Error("No active editor");
    }

    if (content === undefined) {
      throw new Error("Content is required for replace-selection intent");
    }

    await editor.edit((editBuilder) => {
      if (editor.selection.isEmpty) {
        // Insert at cursor
        editBuilder.insert(editor.selection.start, content);
      } else {
        // Replace selection
        editBuilder.replace(editor.selection, content);
      }
    });

    return { success: true, affected: 1 };
  }

  /**
   * Create a git commit
   */
  private async handleGitCommit(
    params: Record<string, unknown>
  ): Promise<ActResult> {
    const message = params.message as string;

    if (!message) {
      throw new Error("Message is required for git-commit intent");
    }

    try {
      // Get the git extension
      const gitExtension = vscode.extensions.getExtension("vscode.git");
      if (!gitExtension) {
        throw new Error("Git extension not available");
      }

      const git = gitExtension.exports.getAPI(1);
      const repo = git.repositories[0];

      if (!repo) {
        throw new Error("No git repository found");
      }

      // Stage all changes if specified
      const stageAll = params.stageAll as boolean;
      if (stageAll) {
        await repo.add([]);
      }

      // Create commit
      await repo.commit(message);

      return { success: true, affected: 1 };
    } catch (error) {
      const err = error as Error;
      throw new Error(`Git commit failed: ${err.message}`);
    }
  }
}
