/**
 * VS Code Context Adapter - Access files, selections, and workspace
 *
 * Provides the IContextAdapter interface for VS Code,
 * enabling agents to query and manipulate editor context.
 */

import * as vscode from "vscode";
import type { IContextAdapter } from "../../types/agentlet";

/**
 * Represents a file item in VS Code context
 */
interface FileItem {
  path: string;
  content?: string;
  languageId: string;
  isDirty: boolean;
  isUntitled: boolean;
}

/**
 * Represents a selection in VS Code context
 */
interface SelectionItem {
  text: string;
  path: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  languageId: string;
}

/**
 * Represents workspace info in VS Code context
 */
interface WorkspaceItem {
  name: string;
  folders: string[];
  rootPath?: string;
}

/**
 * Context adapter implementation for VS Code
 */
export class VSCodeContextAdapter implements IContextAdapter {
  /**
   * Query items by type
   */
  async query(type: string, filter?: unknown): Promise<unknown[]> {
    const f = (filter || {}) as Record<string, unknown>;

    switch (type) {
      case "file":
        return this.queryFiles(f);
      case "workspace":
        return [await this.getWorkspaceInfo()];
      case "editor":
        return this.getOpenEditors();
      case "diagnostic":
        return this.getDiagnostics(f);
      default:
        throw new Error(`Unknown context type: ${type}`);
    }
  }

  /**
   * Get a specific item by ID
   */
  async get(type: string, id: string | number): Promise<unknown> {
    switch (type) {
      case "file":
        return this.getFileByPath(String(id));
      default:
        throw new Error(`Cannot get item of type: ${type}`);
    }
  }

  /**
   * Update an item
   */
  async update(
    type: string,
    id: string | number,
    data: unknown
  ): Promise<void> {
    const d = data as Record<string, unknown>;

    switch (type) {
      case "file":
        await this.updateFile(String(id), d.content as string);
        break;
      default:
        throw new Error(`Cannot update item of type: ${type}`);
    }
  }

  /**
   * Create a new item
   */
  async create(type: string, data: unknown): Promise<unknown> {
    const d = data as Record<string, unknown>;

    switch (type) {
      case "file":
        return this.createFile(d.path as string, d.content as string);
      default:
        throw new Error(`Cannot create item of type: ${type}`);
    }
  }

  /**
   * Delete an item
   */
  async delete(type: string, id: string | number): Promise<void> {
    switch (type) {
      case "file":
        await this.deleteFile(String(id));
        break;
      default:
        throw new Error(`Cannot delete item of type: ${type}`);
    }
  }

  /**
   * Get current selection
   */
  async getSelection(): Promise<unknown[]> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return [];
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      // Return entire file content if no selection
      const document = editor.document;
      return [
        {
          text: document.getText(),
          path: document.uri.fsPath,
          startLine: 0,
          endLine: document.lineCount - 1,
          startColumn: 0,
          endColumn: document.lineAt(document.lineCount - 1).text.length,
          languageId: document.languageId,
        } as SelectionItem,
      ];
    }

    const selectedText = editor.document.getText(selection);
    return [
      {
        text: selectedText,
        path: editor.document.uri.fsPath,
        startLine: selection.start.line,
        endLine: selection.end.line,
        startColumn: selection.start.character,
        endColumn: selection.end.character,
        languageId: editor.document.languageId,
      } as SelectionItem,
    ];
  }

  // ═══ HELPER METHODS ═══

  /**
   * Query files in workspace
   */
  private async queryFiles(
    filter: Record<string, unknown>
  ): Promise<FileItem[]> {
    const pattern = (filter.pattern as string) || "**/*";
    const exclude = (filter.exclude as string) || "**/node_modules/**";
    const limit = (filter.limit as number) || 100;

    const files = await vscode.workspace.findFiles(pattern, exclude, limit);

    const results: FileItem[] = [];
    for (const file of files) {
      try {
        const doc = await vscode.workspace.openTextDocument(file);
        results.push({
          path: file.fsPath,
          languageId: doc.languageId,
          isDirty: doc.isDirty,
          isUntitled: doc.isUntitled,
          // Note: content not included by default for performance
        });
      } catch {
        // Skip files that can't be opened
      }
    }

    return results;
  }

  /**
   * Get file by path with content
   */
  private async getFileByPath(path: string): Promise<FileItem> {
    const uri = vscode.Uri.file(path);
    const doc = await vscode.workspace.openTextDocument(uri);

    return {
      path: doc.uri.fsPath,
      content: doc.getText(),
      languageId: doc.languageId,
      isDirty: doc.isDirty,
      isUntitled: doc.isUntitled,
    };
  }

  /**
   * Update file content
   */
  private async updateFile(path: string, content: string): Promise<void> {
    const uri = vscode.Uri.file(path);
    const doc = await vscode.workspace.openTextDocument(uri);

    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(doc.getText().length)
    );
    edit.replace(uri, fullRange, content);

    await vscode.workspace.applyEdit(edit);
  }

  /**
   * Create a new file
   */
  private async createFile(
    path: string,
    content: string
  ): Promise<FileItem> {
    const uri = vscode.Uri.file(path);
    const encoder = new TextEncoder();

    await vscode.workspace.fs.writeFile(uri, encoder.encode(content));

    return this.getFileByPath(path);
  }

  /**
   * Delete a file
   */
  private async deleteFile(path: string): Promise<void> {
    const uri = vscode.Uri.file(path);
    await vscode.workspace.fs.delete(uri);
  }

  /**
   * Get workspace info
   */
  private async getWorkspaceInfo(): Promise<WorkspaceItem> {
    const folders = vscode.workspace.workspaceFolders || [];

    return {
      name: vscode.workspace.name || "Untitled",
      folders: folders.map((f) => f.uri.fsPath),
      rootPath: folders[0]?.uri.fsPath,
    };
  }

  /**
   * Get open editors
   */
  private getOpenEditors(): FileItem[] {
    const editors = vscode.window.visibleTextEditors;

    return editors.map((editor) => ({
      path: editor.document.uri.fsPath,
      languageId: editor.document.languageId,
      isDirty: editor.document.isDirty,
      isUntitled: editor.document.isUntitled,
    }));
  }

  /**
   * Get diagnostics (errors/warnings)
   */
  private getDiagnostics(filter: Record<string, unknown>): unknown[] {
    const path = filter.path as string | undefined;
    const results: unknown[] = [];

    if (path) {
      // Single file diagnostics
      const uri = vscode.Uri.file(path);
      const diagnostics = vscode.languages.getDiagnostics(uri);

      for (const d of diagnostics) {
        results.push({
          path: uri.fsPath,
          message: d.message,
          severity: vscode.DiagnosticSeverity[d.severity],
          line: d.range.start.line,
          column: d.range.start.character,
          source: d.source,
          code: d.code,
        });
      }
    } else {
      // All diagnostics (array of [Uri, Diagnostic[]] tuples)
      const allDiagnostics = vscode.languages.getDiagnostics();

      for (const [fileUri, fileDiagnostics] of allDiagnostics) {
        for (const d of fileDiagnostics) {
          results.push({
            path: fileUri.fsPath,
            message: d.message,
            severity: vscode.DiagnosticSeverity[d.severity],
            line: d.range.start.line,
            column: d.range.start.character,
            source: d.source,
            code: d.code,
          });
        }
      }
    }

    return results;
  }
}
