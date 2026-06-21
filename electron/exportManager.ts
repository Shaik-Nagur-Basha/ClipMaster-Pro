import { app, BrowserWindow, dialog } from "electron";
import { join } from "path";
import * as fs from "fs";
import * as path from "path";
import XLSX from "xlsx";
import AdmZip from "adm-zip";
import { storageManager } from "./storage";
import type { ClipboardItem, Tag, AppSettings } from "../src/types";

export interface ScopeFilter {
  favourites: "yes" | "no" | null;
  recycle: "yes" | "no" | null;
  havingTags: "yes" | "no" | null;
  specificTags: string[];
  specificTagsMode: "include" | "exclude" | null;
}

export interface ExportOptions {
  source: "all" | "clips" | "tags" | "settings";
  scope: "all" | "clips" | "favorites" | "recycle" | "tagged";
  scopeFilter?: ScopeFilter;
  format: "raw" | "json" | "excel" | "pdf";
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ExportProgress {
  step: "preparing" | "processing" | "generating" | "compressing" | "complete";
  percent: number;
}

export interface ExportSummary {
  totalRecords: number;
  exportType: string;
  format: string;
  fileCount: number;
  finalFileSize: number;
  tempFilePath: string;
  defaultFileName: string;
}

class ExportManager {
  private activeTempDirs: string[] = [];
  private currentCancelFlag = false;

  public cancelExport(): void {
    console.log("[ExportManager] Cancellation requested.");
    this.currentCancelFlag = true;
  }

  public async startExport(
    options: ExportOptions,
    onProgress: (step: string, percent: number) => void
  ): Promise<ExportSummary> {
    this.currentCancelFlag = false;
    onProgress("preparing", 5);

    // 1. Setup temporary workspace
    const tempDir = join(app.getPath("temp"), `clipmaster-export-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    this.activeTempDirs.push(tempDir);

    const generatedFiles: string[] = [];

    try {
      this.checkCancellation();

      // 2. Fetch Data
      onProgress("preparing", 10);
      const tags = await storageManager.getTags();
      const settings = storageManager.getSettings();
      const rawClips = await storageManager.readAll();

      this.checkCancellation();

      // Filter clips based on scope
      let filteredClips = [...rawClips];
      if (options.source === "clips" || options.source === "all") {
        // ── Level 1: Primary scope ───────────────────────────────────────
        if (options.scope === "clips") {
          filteredClips = rawClips.filter((c) => !c.isDeleted);
        } else if (options.scope === "favorites") {
          filteredClips = rawClips.filter((c) => c.isFavorite && !c.isDeleted);
        } else if (options.scope === "recycle") {
          filteredClips = rawClips.filter((c) => c.isDeleted);
        } else if (options.scope === "tagged") {
          filteredClips = rawClips.filter((c) => !c.isDeleted && c.tags && c.tags.length > 0);
        }

        // ── Level 0: Text and Date Filters ──────────────────────────────
        if (options.search && options.search.trim()) {
          const s = options.search.trim().toLowerCase();
          filteredClips = filteredClips.filter((c) => c.text && c.text.toLowerCase().includes(s));
        }
        if (options.dateFrom) {
          const fromTime = new Date(options.dateFrom + "T00:00:00.000Z").getTime();
          filteredClips = filteredClips.filter((c) => {
            if (!c.timestamp) return false;
            return new Date(c.timestamp).getTime() >= fromTime;
          });
        }
        if (options.dateTo) {
          const toTime = new Date(options.dateTo + "T23:59:59.999Z").getTime();
          filteredClips = filteredClips.filter((c) => {
            if (!c.timestamp) return false;
            return new Date(c.timestamp).getTime() <= toTime;
          });
        }

        // ── Level 2 + 3: Sub-filters (applied on top of primary scope) ──
        const sf = options.scopeFilter;
        if (sf && options.scope !== "all") {
          // Favourites dimension
          // (skip if primary scope already fixed this: Only Favorites)
          if (options.scope !== "favorites") {
            if (sf.favourites === "yes") {
              filteredClips = filteredClips.filter((c) => c.isFavorite);
            } else if (sf.favourites === "no") {
              filteredClips = filteredClips.filter((c) => !c.isFavorite);
            }
          }

          // Recycle Bin dimension
          // (skip if primary scope already fixed this: Only Recycle Bin / Only Clips)
          if (options.scope !== "recycle" && options.scope !== "clips") {
            if (sf.recycle === "yes") {
              filteredClips = filteredClips.filter((c) => c.isDeleted);
            } else if (sf.recycle === "no") {
              filteredClips = filteredClips.filter((c) => !c.isDeleted);
            }
          }

          // Having Tags dimension
          // (skip if primary scope already fixed this: Only Having Tags)
          if (options.scope !== "tagged") {
            if (sf.havingTags === "yes") {
              filteredClips = filteredClips.filter((c) => c.tags && c.tags.length > 0);
            } else if (sf.havingTags === "no") {
              filteredClips = filteredClips.filter((c) => !c.tags || c.tags.length === 0);
            }
          }

          // Specific Tags dimension
          // Only applicable when having tags is not "no" (i.e. tags can exist)
          const tagsApplicable =
            options.scope === "tagged" ||
            (sf.havingTags !== "no" && sf.specificTags && sf.specificTags.length > 0);

          if (tagsApplicable && sf.specificTags && sf.specificTags.length > 0 && sf.specificTagsMode) {
            if (sf.specificTagsMode === "include") {
              // From selection — clips that have at least one of the selected tags
              filteredClips = filteredClips.filter(
                (c) => c.tags && c.tags.some((t) => sf.specificTags.includes(t))
              );
            } else if (sf.specificTagsMode === "exclude") {
              // Not from selection — clips that have none of the selected tags
              filteredClips = filteredClips.filter(
                (c) => !c.tags || !c.tags.some((t) => sf.specificTags.includes(t))
              );
            }
          }
        }
      }

      // Calculate total records
      let totalRecords = 0;
      if (options.source === "all") {
        totalRecords = filteredClips.length + tags.length + 1; // clips + tags + settings
      } else if (options.source === "clips") {
        totalRecords = filteredClips.length;
      } else if (options.source === "tags") {
        totalRecords = tags.length;
      } else if (options.source === "settings") {
        totalRecords = 1;
      }

      onProgress("processing", 15);
      const tagMap = new Map<string, string>();
      tags.forEach((t) => tagMap.set(t.id, t.name));

      this.checkCancellation();

      // 3. Process & Generate Files
      const timestampStr = this.getTimestampString();
      const filesToGenerate: { name: string; data: any; type: "clips" | "tags" | "settings" }[] = [];

      if (options.source === "all" || options.source === "clips") {
        filesToGenerate.push({ name: `clips`, data: filteredClips, type: "clips" });
      }
      if (options.source === "all" || options.source === "tags") {
        filesToGenerate.push({ name: `tags`, data: tags, type: "tags" });
      }
      if (options.source === "all" || options.source === "settings") {
        filesToGenerate.push({ name: `settings`, data: settings, type: "settings" });
      }

      const totalFiles = filesToGenerate.length;
      let filesProcessed = 0;

      for (const item of filesToGenerate) {
        this.checkCancellation();
        onProgress(
          "processing",
          Math.min(15 + Math.round((filesProcessed / totalFiles) * 45), 60)
        );

        const fileExt = this.getFileExtension(options.format);
        const fileName = `${item.name}_${timestampStr}.${fileExt}`;
        const filePath = join(tempDir, fileName);

        if (options.format === "raw") {
          // Raw actual NeDB database format (just direct stringified JSON)
          fs.writeFileSync(filePath, JSON.stringify(item.data, null, 2), "utf-8");
        } else if (options.format === "json") {
          // Human-readable, cleaned JSON export
          const cleanData = this.getCleanedData(item.data, item.type, tagMap);
          fs.writeFileSync(filePath, JSON.stringify(cleanData, null, 2), "utf-8");
        } else if (options.format === "excel") {
          const wsData = this.getExcelSheetData(item.data, item.type, tagMap);
          const ws = XLSX.utils.json_to_sheet(wsData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, item.type.toUpperCase());
          XLSX.writeFile(wb, filePath);
        } else if (options.format === "pdf") {
          const htmlContent = this.getPdfHtmlLayout(item.data, item.type, tagMap);
          await this.generatePdfFromHtml(htmlContent, filePath);
        }

        generatedFiles.push(filePath);
        filesProcessed++;
      }

      this.checkCancellation();
      onProgress("generating", 75);

      // 4. Compress if multiple files generated
      let finalFilePath = "";
      let isZip = false;

      if (generatedFiles.length > 1) {
        onProgress("compressing", 85);
        isZip = true;
        const zipName = `clipmaster_backup_${options.source}_${timestampStr}.zip`;
        const zipPath = join(tempDir, "..", zipName);

        const zip = new AdmZip();
        for (const file of generatedFiles) {
          zip.addLocalFile(file);
        }
        zip.writeZip(zipPath);
        finalFilePath = zipPath;

        // Clean up internal individual files since they are zipped
        for (const file of generatedFiles) {
          try {
            fs.unlinkSync(file);
          } catch (e) {}
        }
      } else {
        finalFilePath = generatedFiles[0];
      }

      this.checkCancellation();
      onProgress("complete", 100);

      // Read final file size
      const stats = fs.statSync(finalFilePath);
      const finalFileSize = stats.size;

      // Build default filename
      let defaultFileName = "";
      const basePrefix = options.source === "all" ? "clipmaster_all" : `clipmaster_${options.source}`;
      const baseExt = isZip ? "zip" : this.getFileExtension(options.format);
      defaultFileName = `${basePrefix}_${timestampStr}.${baseExt}`;

      return {
        totalRecords,
        exportType: this.getReadableExportType(options.source, options.scope, options.scopeFilter),
        format: this.getReadableFormat(options.format),
        fileCount: isZip ? generatedFiles.length : 1,
        finalFileSize,
        tempFilePath: finalFilePath,
        defaultFileName,
      };
    } catch (err: any) {
      // Cleanup files on error
      this.cleanupTempDir(tempDir);
      if (generatedFiles.length > 1) {
        // Zip path cleanup if it was created
        const zipFile = this.activeTempDirs.find((d) => d.endsWith(".zip"));
        if (zipFile && fs.existsSync(zipFile)) {
          try {
            fs.unlinkSync(zipFile);
          } catch (e) {}
        }
      }
      throw err;
    }
  }

  public async saveExportFile(tempFilePath: string, defaultName: string): Promise<boolean> {
    const ext = path.extname(tempFilePath).replace(".", "");
    const result = await dialog.showSaveDialog({
      title: "Save ClipMaster Pro Export",
      defaultPath: join(app.getPath("downloads"), defaultName),
      filters: [{ name: `${ext.toUpperCase()} Files`, extensions: [ext] }],
    });

    if (!result.canceled && result.filePath) {
      fs.copyFileSync(tempFilePath, result.filePath);
      return true;
    }
    return false;
  }

  public cleanupExport(): void {
    console.log("[ExportManager] Cleaning up temporary files...");
    const dirs = [...this.activeTempDirs];
    this.activeTempDirs = [];
    for (const dir of dirs) {
      this.cleanupTempDir(dir);
    }
  }

  private cleanupTempDir(dir: string): void {
    try {
      if (fs.existsSync(dir)) {
        const stats = fs.statSync(dir);
        if (stats.isDirectory()) {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            fs.unlinkSync(join(dir, file));
          }
          fs.rmdirSync(dir);
        } else {
          fs.unlinkSync(dir);
        }
      }
    } catch (e) {
      console.warn(`[ExportManager] Failed to cleanup path ${dir}:`, e);
    }
  }

  private checkCancellation(): void {
    if (this.currentCancelFlag) {
      throw new Error("CANCELLED");
    }
  }

  private getTimestampString(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
  }

  private getFileExtension(format: ExportOptions["format"]): string {
    switch (format) {
      case "raw":
      case "json":
        return "json";
      case "excel":
        return "xlsx";
      case "pdf":
        return "pdf";
    }
  }

  private getReadableExportType(source: string, scope: string, sf?: ScopeFilter): string {
    if (source === "all") return "All Data (Backup Package)";
    if (source === "tags") return "Tags Only";
    if (source === "settings") return "Settings Only";

    const scopeLabel = ((): string => {
      switch (scope) {
        case "all":      return "All Clip Data";
        case "clips":    return "Not Recycle Bin";
        case "favorites":return "Only Favorites";
        case "recycle":  return "Only Recycle Bin";
        case "tagged":   return "Only Having Tags";
        default:         return scope;
      }
    })();

    if (!sf || scope === "all") return `Clips — ${scopeLabel}`;

    const parts: string[] = [];
    if (scope !== "favorites") {
      if (sf.favourites === "yes") parts.push("Only Favorites");
      else if (sf.favourites === "no") parts.push("Not Favorites");
    }
    if (scope !== "recycle" && scope !== "clips") {
      if (sf.recycle === "yes") parts.push("In Recycle Bin");
      else if (sf.recycle === "no") parts.push("Not In Recycle Bin");
    }
    if (scope !== "tagged") {
      if (sf.havingTags === "yes") parts.push("Having Tags");
      else if (sf.havingTags === "no") parts.push("No Tags");
    }
    if (sf.specificTags && sf.specificTags.length > 0 && sf.specificTagsMode) {
      const tagCount = sf.specificTags.length;
      if (sf.specificTagsMode === "include") parts.push(`From ${tagCount} Tag(s)`);
      else parts.push(`Excluding ${tagCount} Tag(s)`);
    }

    const subLabel = parts.length > 0 ? ` + ${parts.join(" · ")}` : "";
    return `Clips — ${scopeLabel}${subLabel}`;
  }

  private getReadableFormat(format: string): string {
    switch (format) {
      case "raw":
        return "Raw Actual Data Format";
      case "json":
        return "JSON";
      case "excel":
        return "Excel (.xlsx)";
      case "pdf":
        return "PDF (.pdf)";
      default:
        return format;
    }
  }

  private getCleanedData(data: any, type: "clips" | "tags" | "settings", tagMap: Map<string, string>): any {
    if (type === "clips") {
      const items = data as ClipboardItem[];
      return items.map((c) => ({
        id: c.id,
        text: c.text,
        timestamp: c.timestamp,
        updatedAt: c.updatedAt,
        isFavorite: c.isFavorite,
        isDeleted: c.isDeleted,
        tags: c.tags.map((id) => tagMap.get(id) || id),
        wordCount: c.wordCount,
        charCount: c.charCount,
      }));
    } else if (type === "tags") {
      const items = data as Tag[];
      return items.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
      }));
    }
    return data; // Settings is already clean
  }

  private getExcelSheetData(data: any, type: "clips" | "tags" | "settings", tagMap: Map<string, string>): any[] {
    if (type === "clips") {
      const items = data as ClipboardItem[];
      return items.map((c, index) => ({
        "Index": index + 1,
        "ID": c.id,
        "Clipboard Content": c.text.length <= 32767 ? c.text : c.text.substring(0, 32700) + " ... [Truncated: Exceeded Excel's 32,767 character limit]",
        "Date Captured": c.timestamp,
        "Date Updated": c.updatedAt || c.timestamp,
        "Is Favorite": c.isFavorite ? "Yes" : "No",
        "Is Deleted": c.isDeleted ? "Yes" : "No",
        "Word Count": c.wordCount || 0,
        "Char Count": c.charCount || 0,
        "Tags": c.tags.map((id) => tagMap.get(id) || id).join(", "),
      }));
    } else if (type === "tags") {
      const items = data as Tag[];
      return items.map((t, index) => ({
        "Index": index + 1,
        "Tag ID": t.id,
        "Tag Name": t.name,
        "Tag Color": t.color,
      }));
    } else {
      const s = data as AppSettings;
      return [
        { "Setting Key": "Launch at Windows startup", "Value": s.autoLaunch ? "Enabled" : "Disabled" },

        { "Setting Key": "Max Stored Clips", "Value": s.maxEntries },
        { "Setting Key": "Clipboard Monitoring Polling Interval (ms)", "Value": s.pollingInterval },
        { "Setting Key": "Enable Pagination", "Value": s.paginationEnabled ? "Yes" : "No" },
        { "Setting Key": "Page Size", "Value": s.pageSize || 10 },
        { "Setting Key": "View Mode", "Value": s.viewMode },
        { "Setting Key": "Display Mode", "Value": s.displayMode },
      ];
    }
  }

  private getPdfHtmlLayout(data: any, type: "clips" | "tags" | "settings", tagMap: Map<string, string>): string {
    let contentHtml = "";

    // ─── Optimize PDF for size: Use Helvetica standard system font (no external loads) ───
    const styleHeader = `
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          background-color: #0d0d1a;
          color: #f1f5f9;
          margin: 0;
          padding: 24px;
          font-size: 13px;
          line-height: 1.5;
        }
        .header {
          border-bottom: 2px solid #3b82f6;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }
        .title {
          font-size: 20px;
          font-weight: bold;
          color: #ffffff;
        }
        .subtitle {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 4px;
        }
        .section-title {
          font-size: 14px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #60a5fa;
          margin-top: 24px;
          margin-bottom: 12px;
        }
        /* Card styles for clips */
        .card {
          background-color: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
          page-break-inside: avoid;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #64748b;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 8px;
          margin-bottom: 8px;
        }
        .card-title {
          font-weight: bold;
          color: #94a3b8;
        }
        .card-body {
          font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
          background-color: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
          padding: 10px;
          color: #cbd5e1;
          white-space: pre-wrap;
          word-break: break-all;
          font-size: 11px;
        }
        .badge {
          display: inline-block;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 99px;
          margin-right: 4px;
          font-weight: bold;
        }
        .badge-favorite {
          background-color: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }
        .badge-deleted {
          background-color: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .tag-pill {
          background-color: rgba(59, 130, 246, 0.1);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.2);
        }
        /* Table styles for tags / settings */
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }
        th, td {
          text-align: left;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        th {
          background-color: rgba(255, 255, 255, 0.04);
          font-weight: bold;
          color: #94a3b8;
          font-size: 11px;
          text-transform: uppercase;
        }
        td {
          color: #cbd5e1;
        }
        .color-preview {
          display: inline-block;
          width: 12px;
          height: 12px;
          border-radius: 3px;
          vertical-align: middle;
          margin-right: 6px;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
      </style>
    `;

    if (type === "clips") {
      const items = data as ClipboardItem[];
      contentHtml += `<div class="section-title">Clipboard Entries (${items.length})</div>`;
      items.forEach((c, idx) => {
        const badges: string[] = [];
        if (c.isFavorite) badges.push(`<span class="badge badge-favorite">★ Favorite</span>`);
        if (c.isDeleted) badges.push(`<span class="badge badge-deleted">Recycle Bin</span>`);
        c.tags.forEach((tId) => {
          const tName = tagMap.get(tId) || tId;
          badges.push(`<span class="badge tag-pill">${tName}</span>`);
        });

        const formattedDate = new Date(c.timestamp).toLocaleString();

        contentHtml += `
          <div class="card">
            <div class="card-header">
              <span class="card-title">Clip #${idx + 1} (${c.id.substring(0, 8)})</span>
              <span>${formattedDate}</span>
            </div>
            <div style="margin-bottom: 10px;">${badges.join("")}</div>
            <div class="card-body">${this.escapeHtml(c.text)}</div>
          </div>
        `;
      });
    } else if (type === "tags") {
      const items = data as Tag[];
      contentHtml += `
        <div class="section-title">Application Tags (${items.length})</div>
        <table>
          <thead>
            <tr>
              <th style="width: 80px;">Index</th>
              <th>Tag ID</th>
              <th>Tag Name</th>
              <th>Display Color</th>
            </tr>
          </thead>
          <tbody>
      `;
      items.forEach((t, idx) => {
        contentHtml += `
          <tr>
            <td>${idx + 1}</td>
            <td style="font-family: monospace;">${t.id}</td>
            <td style="font-weight: bold; color: ${t.color}">${this.escapeHtml(t.name)}</td>
            <td>
              <span class="color-preview" style="background-color: ${t.color}"></span>
              <code>${t.color}</code>
            </td>
          </tr>
        `;
      });
      contentHtml += `</tbody></table>`;
    } else {
      const s = data as AppSettings;
      contentHtml += `
        <div class="section-title">Application Settings</div>
        <table>
          <thead>
            <tr>
              <th>Setting Parameter</th>
              <th>Configured Value</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Launch at Windows startup</td><td><strong>${s.autoLaunch ? "Enabled" : "Disabled"}</strong></td></tr>

            <tr><td>Max Clip Capacity</td><td><strong>${s.maxEntries} clips</strong></td></tr>
            <tr><td>Polling Capture Interval</td><td><strong>${s.pollingInterval} ms</strong></td></tr>
            <tr><td>Pagination status</td><td><strong>${s.paginationEnabled ? "Enabled" : "Disabled"}</strong></td></tr>
            <tr><td>Default Page Size</td><td><strong>${s.pageSize || 10} records</strong></td></tr>
            <tr><td>Default View Mode</td><td><code>${s.viewMode}</code></td></tr>
            <tr><td>Default Display Mode</td><td><code>${s.displayMode}</code></td></tr>
          </tbody>
        </table>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>ClipMaster Pro PDF Export</title>
          ${styleHeader}
        </head>
        <body>
          <div class="header">
            <div class="title">ClipMaster Pro</div>
            <div class="subtitle">Data Export generated on ${new Date().toLocaleString()}</div>
          </div>
          ${contentHtml}
        </body>
      </html>
    `;
  }

  private async generatePdfFromHtml(htmlContent: string, outputPath: string): Promise<void> {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const tempHtmlPath = outputPath + ".temp.html";

    try {
      fs.writeFileSync(tempHtmlPath, htmlContent, "utf-8");
      await win.loadFile(tempHtmlPath);
      // Wait for rendering to settle
      await new Promise((resolve) => setTimeout(resolve, 800));

      this.checkCancellation();

      // Optimize print options for size/compression
      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: "A4",
        margins: {
          marginType: "default",
        },
      });

      this.checkCancellation();
      fs.writeFileSync(outputPath, pdfBuffer);
    } finally {
      win.destroy();
      try {
        if (fs.existsSync(tempHtmlPath)) {
          fs.unlinkSync(tempHtmlPath);
        }
      } catch (err) {
        console.warn("[ExportManager] Failed to delete temporary HTML file:", err);
      }
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

export const exportManager = new ExportManager();
