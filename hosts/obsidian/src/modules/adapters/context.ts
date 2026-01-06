/**
 * Obsidian Context Adapter - Provides access to vault data
 *
 * HOST-SPECIFIC: This is entirely Obsidian-specific, using the Obsidian API
 */

import { App, TFile, TFolder, MarkdownView } from "obsidian";
import { IContextAdapter } from "../../types/agentlet";

/**
 * Context adapter implementation for Obsidian
 * Provides access to notes, folders, tags via Obsidian's Vault API
 */
export class ObsidianContextAdapter implements IContextAdapter {
  constructor(private app: App) {}

  getAppVersion(): string {
    return (this.app as any).version || "1.0.0";
  }

  async query(type: string, filter?: any): Promise<any[]> {
    switch (type) {
      case "note":
        return this.queryNotes(filter);
      case "folder":
        return this.queryFolders(filter);
      case "tag":
        return this.queryTags(filter);
      default:
        throw new Error(`Unsupported context type: ${type}`);
    }
  }

  private async queryNotes(filter?: any): Promise<any[]> {
    const files = this.app.vault.getMarkdownFiles();

    let results = files.map((file) => this.fileToNote(file));

    if (filter?.folder) {
      results = results.filter((n) => n.path.startsWith(filter.folder));
    }
    if (filter?.tag) {
      const tag = filter.tag.startsWith("#") ? filter.tag : `#${filter.tag}`;
      results = results.filter((n) => n.tags?.includes(tag));
    }
    if (filter?.search) {
      // Simple search - check title and tags
      const query = filter.search.toLowerCase();
      results = results.filter(
        (n) =>
          n.title?.toLowerCase().includes(query) ||
          n.tags?.some((t: string) => t.toLowerCase().includes(query))
      );
    }

    return results;
  }

  private queryFolders(filter?: any): Promise<any[]> {
    const folders: any[] = [];

    const processFolder = (folder: TFolder, depth = 0) => {
      folders.push({
        id: folder.path,
        path: folder.path,
        name: folder.name,
      });

      if (depth < 10) {
        for (const child of folder.children) {
          if (child instanceof TFolder) {
            processFolder(child, depth + 1);
          }
        }
      }
    };

    processFolder(this.app.vault.getRoot());
    return Promise.resolve(folders);
  }

  private queryTags(filter?: any): Promise<any[]> {
    const tags = new Map<string, number>();

    for (const file of this.app.vault.getMarkdownFiles()) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.tags) {
        for (const tag of cache.tags) {
          const count = tags.get(tag.tag) || 0;
          tags.set(tag.tag, count + 1);
        }
      }
      // Also check frontmatter tags
      if (cache?.frontmatter?.tags) {
        const fmTags = Array.isArray(cache.frontmatter.tags)
          ? cache.frontmatter.tags
          : [cache.frontmatter.tags];
        for (const tag of fmTags) {
          const normalizedTag = tag.startsWith("#") ? tag : `#${tag}`;
          const count = tags.get(normalizedTag) || 0;
          tags.set(normalizedTag, count + 1);
        }
      }
    }

    return Promise.resolve(
      Array.from(tags.entries()).map(([tag, count]) => ({
        id: tag,
        tag,
        count,
      }))
    );
  }

  private fileToNote(file: TFile): any {
    const cache = this.app.metadataCache.getFileCache(file);

    // Collect all tags
    const tags: string[] = [];
    if (cache?.tags) {
      tags.push(...cache.tags.map((t) => t.tag));
    }
    if (cache?.frontmatter?.tags) {
      const fmTags = Array.isArray(cache.frontmatter.tags)
        ? cache.frontmatter.tags
        : [cache.frontmatter.tags];
      for (const tag of fmTags) {
        const normalizedTag = tag.startsWith("#") ? tag : `#${tag}`;
        if (!tags.includes(normalizedTag)) {
          tags.push(normalizedTag);
        }
      }
    }

    return {
      id: file.path,
      path: file.path,
      name: file.basename,
      title: file.basename,
      content: null, // Load on demand to save memory
      tags,
      frontmatter: cache?.frontmatter || {},
      links: cache?.links?.map((l) => l.link) || [],
      backlinks: this.getBacklinkPaths(file),
      created: file.stat.ctime,
      modified: file.stat.mtime,
    };
  }

  private getBacklinkPaths(file: TFile): string[] {
    const backlinks: string[] = [];

    // Get all files that link to this file
    for (const otherFile of this.app.vault.getMarkdownFiles()) {
      if (otherFile.path === file.path) continue;

      const cache = this.app.metadataCache.getFileCache(otherFile);
      if (cache?.links) {
        for (const link of cache.links) {
          const linkedFile = this.app.metadataCache.getFirstLinkpathDest(
            link.link,
            otherFile.path
          );
          if (linkedFile?.path === file.path) {
            backlinks.push(otherFile.path);
            break;
          }
        }
      }
    }

    return backlinks;
  }

  async getSelection(): Promise<any[]> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) return [];

    const note = this.fileToNote(activeFile);

    // Check for text selection in editor
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.editor) {
      const selection = view.editor.getSelection();
      if (selection) {
        note.selectedText = selection;
      }
    }

    // Load content for selection
    note.content = await this.app.vault.read(activeFile);

    return [note];
  }

  async get(type: string, id: string): Promise<any> {
    if (type === "note") {
      const file = this.app.vault.getAbstractFileByPath(id);
      if (file instanceof TFile) {
        const note = this.fileToNote(file);
        note.content = await this.app.vault.read(file);
        return note;
      }
    }
    throw new Error(`Not found: ${type}/${id}`);
  }

  async update(type: string, id: string, data: any): Promise<void> {
    if (type === "note") {
      const file = this.app.vault.getAbstractFileByPath(id);
      if (!(file instanceof TFile)) throw new Error("Not found");

      if (data.content !== undefined) {
        await this.app.vault.modify(file, data.content);
      }
      if (data.frontmatter !== undefined) {
        await this.updateFrontmatter(file, data.frontmatter);
      }
      if (data.tags !== undefined) {
        await this.updateTags(file, data.tags);
      }
      if (data.path !== undefined && data.path !== id) {
        await this.app.vault.rename(file, data.path);
      }
      return;
    }
    throw new Error(`Cannot update type: ${type}`);
  }

  async create(type: string, data: any): Promise<any> {
    if (type === "note") {
      const path = data.path || `${data.title || "Untitled"}.md`;
      let content = data.content || "";

      // Add frontmatter if provided
      if (data.frontmatter && Object.keys(data.frontmatter).length > 0) {
        const yaml = Object.entries(data.frontmatter)
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join("\n");
        content = `---\n${yaml}\n---\n\n${content}`;
      }

      const file = await this.app.vault.create(path, content);
      return this.fileToNote(file);
    }

    if (type === "folder") {
      await this.app.vault.createFolder(data.path);
      return {
        id: data.path,
        path: data.path,
        name: data.path.split("/").pop(),
      };
    }

    throw new Error(`Cannot create type: ${type}`);
  }

  async delete(type: string, id: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(id);
    if (file) {
      await this.app.vault.delete(file);
    }
  }

  private async updateFrontmatter(
    file: TFile,
    frontmatter: any
  ): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      Object.assign(fm, frontmatter);
    });
  }

  private async updateTags(file: TFile, tags: string[]): Promise<void> {
    // Normalize tags (remove # prefix for frontmatter storage)
    const normalizedTags = tags.map((t) =>
      t.startsWith("#") ? t.slice(1) : t
    );

    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.tags = normalizedTags;
    });
  }
}
