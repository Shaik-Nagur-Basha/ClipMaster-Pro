import { app, dialog, BrowserWindow } from "electron";
import { join } from "path";
import * as fs from "fs";
import * as path from "path";
import AdmZip from "adm-zip";
import { v4 as uuidv4 } from "uuid";
import { storageManager } from "./storage";
import { syncManager } from "./syncManager";
import type { ClipboardItem, Tag, AppSettings } from "../src/types";

export interface ImportSummary {
  success: boolean;
  importedClips: number;
  skippedClips: number;
  importedTags: number;
  skippedTags: number;
  importedSettings: boolean;
  error?: string;
}

class ImportManager {
  private activeTempDirs: string[] = [];

  public async selectAndImportFile(
    browserWindow: BrowserWindow,
    onProgress: (step: string, percent: number) => void
  ): Promise<ImportSummary> {
    onProgress("preparing", 5);

    // 1. Show file selection dialog
    const result = await dialog.showOpenDialog(browserWindow, {
      title: "Import ClipMaster Pro Data",
      filters: [
        { name: "ClipMaster Backup Files (*.json, *.zip)", extensions: ["json", "zip"] }
      ],
      properties: ["openFile"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return {
        success: false,
        importedClips: 0,
        skippedClips: 0,
        importedTags: 0,
        skippedTags: 0,
        importedSettings: false,
        error: "Import cancelled by user."
      };
    }

    const filePath = result.filePaths[0];
    onProgress("preparing", 15);

    const isZip = filePath.toLowerCase().endsWith(".zip");
    const tempDir = join(app.getPath("temp"), `clipmaster-import-${Date.now()}`);
    this.activeTempDirs.push(tempDir);
    
    let jsonFiles: { name: string; content: string }[] = [];

    try {
      // 2. Extract files if it is a ZIP, or read the JSON directly
      if (isZip) {
        onProgress("preparing", 25);
        fs.mkdirSync(tempDir, { recursive: true });
        const zip = new AdmZip(filePath);
        zip.extractAllTo(tempDir, true);
        
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          if (file.toLowerCase().endsWith(".json")) {
            const fileContent = fs.readFileSync(join(tempDir, file), "utf-8");
            jsonFiles.push({ name: file, content: fileContent });
          }
        }
      } else {
        onProgress("preparing", 30);
        const fileContent = fs.readFileSync(filePath, "utf-8");
        jsonFiles.push({ name: path.basename(filePath), content: fileContent });
      }

      if (jsonFiles.length === 0) {
        throw new Error("No valid JSON data files found in the selected backup.");
      }

      onProgress("processing", 40);

      // Sort files: Tags first, then Clips, then Settings.
      // This ensures tag mappings are populated before clips reference them.
      const getPriority = (name: string) => {
        const lower = name.toLowerCase();
        if (lower.startsWith("tags")) return 1;
        if (lower.startsWith("clips")) return 2;
        if (lower.startsWith("settings")) return 3;
        return 4;
      };
      jsonFiles.sort((a, b) => getPriority(a.name) - getPriority(b.name));

      let clipsToImport: any[] = [];
      let tagsToImport: any[] = [];
      let settingsToImport: any = null;

      // Parse and group the file contents
      for (const file of jsonFiles) {
        const parsed = JSON.parse(file.content);
        if (Array.isArray(parsed)) {
          if (parsed.length > 0) {
            const first = parsed[0];
            if (first && typeof first === "object") {
              if ("text" in first) {
                clipsToImport.push(...parsed);
              } else if ("name" in first && "color" in first) {
                tagsToImport.push(...parsed);
              } else {
                // Content inspection fallback
                if (file.name.toLowerCase().includes("clips")) {
                  clipsToImport.push(...parsed);
                } else if (file.name.toLowerCase().includes("tags")) {
                  tagsToImport.push(...parsed);
                }
              }
            }
          }
        } else if (parsed && typeof parsed === "object") {
          // Check if unified backup JSON format
          if ("clips" in parsed && Array.isArray(parsed.clips)) {
            clipsToImport.push(...parsed.clips);
          }
          if ("tags" in parsed && Array.isArray(parsed.tags)) {
            tagsToImport.push(...parsed.tags);
          }
          if ("settings" in parsed && parsed.settings && typeof parsed.settings === "object") {
            settingsToImport = parsed.settings;
          }

          // Check if setting keys exist directly on root object
          if (!("clips" in parsed) && !("tags" in parsed) && !("settings" in parsed)) {
            const hasSettingsKeys = ["maxEntries", "pollingInterval", "autoLaunch", "viewMode", "displayMode"].some(
              (k) => k in parsed
            );
            if (hasSettingsKeys) {
              settingsToImport = parsed;
            }
          }
        }
      }

      onProgress("processing", 60);

      // 3. Load existing databases for deduplication
      const existingTags = await storageManager.getTags();
      const existingTagIds = new Set(existingTags.map((t) => t.id));
      const existingTagNames = new Set(existingTags.map((t) => t.name.toLowerCase().trim()));

      const tagMapping = new Map<string, string>();
      existingTags.forEach((t) => {
        tagMapping.set(t.id, t.id);
        tagMapping.set(t.name.toLowerCase().trim(), t.id);
      });

      let importedTags = 0;
      let skippedTags = 0;

      // 4. Import Tags
      for (const rawTag of tagsToImport) {
        if (!rawTag || typeof rawTag !== "object") {
          skippedTags++;
          continue;
        }

        const name = typeof rawTag.name === "string" ? rawTag.name.trim() : "";
        if (!name) {
          skippedTags++;
          continue; // Tag name is required and cannot be empty
        }

        const id = typeof rawTag.id === "string" && rawTag.id.trim() ? rawTag.id.trim() : uuidv4();
        let color = typeof rawTag.color === "string" ? rawTag.color.trim() : "";
        if (!color || !/^#([0-9A-F]{3}){1,2}$/i.test(color)) {
          color = "#6366f1"; // Fallback color
        }

        const nameLower = name.toLowerCase();

        // Conflict check: Keep existing ("keep of old one")
        if (existingTagIds.has(id) || existingTagNames.has(nameLower)) {
          skippedTags++;
          const matchingTag = existingTags.find(
            (t) => t.id === id || t.name.toLowerCase().trim() === nameLower
          );
          if (matchingTag) {
            tagMapping.set(id, matchingTag.id);
            tagMapping.set(nameLower, matchingTag.id);
          }
          continue;
        }

        const newTag: Tag = { id, name, color };
        if (rawTag.updatedAt) {
          newTag.updatedAt = rawTag.updatedAt;
        }

        await storageManager.tagsDb.insertAsync(newTag);
        existingTags.push(newTag);
        existingTagIds.add(id);
        existingTagNames.add(nameLower);
        tagMapping.set(id, id);
        tagMapping.set(nameLower, id);
        importedTags++;
      }

      onProgress("generating", 75);

      // 5. Import Clips
      const allClips = await storageManager.readAll();
      const existingClipTexts = new Set(allClips.map((c) => c.text.trim()));
      const existingClipIds = new Set(allClips.map((c) => c.id));

      let importedClips = 0;
      let skippedClips = 0;

      for (const rawClip of clipsToImport) {
        if (!rawClip || typeof rawClip !== "object") {
          skippedClips++;
          continue;
        }

        const text = typeof rawClip.text === "string" ? rawClip.text.trim() : "";
        if (!text) {
          skippedClips++;
          continue; // Clip text cannot be empty
        }

        const id = typeof rawClip.id === "string" && rawClip.id.trim() ? rawClip.id.trim() : uuidv4();

        // Conflict check: Keep existing ("keep of old one")
        if (existingClipIds.has(id) || existingClipTexts.has(text)) {
          skippedClips++;
          continue;
        }

        const now = new Date().toISOString();
        const timestamp = typeof rawClip.timestamp === "string" && Date.parse(rawClip.timestamp) ? rawClip.timestamp : now;
        const updatedAt = typeof rawClip.updatedAt === "string" && Date.parse(rawClip.updatedAt) ? rawClip.updatedAt : timestamp;

        // Resolve tag IDs / Names
        const tags: string[] = [];
        if (Array.isArray(rawClip.tags)) {
          for (const t of rawClip.tags) {
            if (typeof t !== "string") continue;
            const trimmedTag = t.trim();
            if (!trimmedTag) continue;

            const tagKey = trimmedTag.toLowerCase();
            if (tagMapping.has(trimmedTag)) {
              tags.push(tagMapping.get(trimmedTag)!);
            } else if (tagMapping.has(tagKey)) {
              tags.push(tagMapping.get(tagKey)!);
            } else {
              // Create missing tag dynamically
              const newTagId = uuidv4();
              const newTagName = trimmedTag;
              const newTagColor = "#6366f1";

              const newTag: Tag = { id: newTagId, name: newTagName, color: newTagColor };
              await storageManager.tagsDb.insertAsync(newTag);

              existingTags.push(newTag);
              existingTagIds.add(newTagId);
              existingTagNames.add(newTagName.toLowerCase().trim());
              tagMapping.set(newTagId, newTagId);
              tagMapping.set(newTagName.toLowerCase().trim(), newTagId);

              tags.push(newTagId);
              importedTags++;
            }
          }
        }

        const wordCount = typeof rawClip.wordCount === "number" ? rawClip.wordCount : text.split(/\s+/).filter(Boolean).length;
        const charCount = typeof rawClip.charCount === "number" ? rawClip.charCount : text.length;

        const clipItem: ClipboardItem = {
          id,
          text,
          timestamp,
          updatedAt,
          tags,
          isFavorite: Boolean(rawClip.isFavorite),
          isDeleted: Boolean(rawClip.isDeleted),
          wordCount,
          charCount,
          version: typeof rawClip.version === "number" ? rawClip.version : 1,
          localMongoVersion: typeof rawClip.localMongoVersion === "number" ? rawClip.localMongoVersion : 0,
          atlasVersion: typeof rawClip.atlasVersion === "number" ? rawClip.atlasVersion : 0
        };

        if (rawClip.deletedAt) {
          clipItem.deletedAt = rawClip.deletedAt;
        }

        await storageManager.clipsDb.insertAsync(clipItem);
        
        // Enqueue clip in synchronization manager
        await syncManager.enqueue(clipItem, "upsert");

        existingClipIds.add(id);
        existingClipTexts.add(text);
        importedClips++;
      }

      onProgress("generating", 90);

      // 6. Import Settings
      let importedSettings = false;
      if (settingsToImport && typeof settingsToImport === "object") {
        const partialSettings: Partial<AppSettings> = {};

        const assignBool = (key: keyof AppSettings) => {
          if (key in settingsToImport && typeof settingsToImport[key] === "boolean") {
            partialSettings[key] = settingsToImport[key] as any;
          }
        };

        const assignNumber = (key: keyof AppSettings, minVal?: number) => {
          if (key in settingsToImport && typeof settingsToImport[key] === "number") {
            const val = settingsToImport[key] as number;
            if (minVal === undefined || val >= minVal) {
              partialSettings[key] = val as any;
            }
          }
        };

        const assignString = (key: keyof AppSettings, allowedValues?: string[]) => {
          if (key in settingsToImport && typeof settingsToImport[key] === "string") {
            const val = settingsToImport[key] as string;
            if (!allowedValues || allowedValues.includes(val)) {
              partialSettings[key] = val as any;
            }
          }
        };

        assignBool("autoLaunch");
        assignBool("mongoEnabled");
        if ("mongoUri" in settingsToImport && (typeof settingsToImport.mongoUri === "string" || settingsToImport.mongoUri === null)) {
          if (settingsToImport.mongoUri !== "") {
            partialSettings.mongoUri = settingsToImport.mongoUri;
          }
        }
        assignBool("atlasEnabled");
        if ("atlasUri" in settingsToImport && (typeof settingsToImport.atlasUri === "string" || settingsToImport.atlasUri === null)) {
          if (settingsToImport.atlasUri !== "") {
            partialSettings.atlasUri = settingsToImport.atlasUri;
          }
        }
        assignNumber("maxEntries", 10);
        assignNumber("pollingInterval", 100);
        assignBool("paginationEnabled");
        assignNumber("pageSize", 1);
        assignString("viewMode", ["list", "grid", "compact"]);
        assignString("displayMode", ["preview", "full"]);
        assignString("pauseCaptureOption", ["never", "15mins", "30mins", "1hour", "restart"]);

        if (Object.keys(partialSettings).length > 0) {
          await storageManager.saveSettings(partialSettings);

          if ("autoLaunch" in partialSettings) {
            app.setLoginItemSettings({
              openAtLogin: Boolean(partialSettings.autoLaunch),
              name: "ClipMaster Pro",
              path: app.getPath("exe"),
              args: ["--hidden"],
            });
          }
          importedSettings = true;
        }
      }

      // Enqueue tag sync if tags were added
      if (importedTags > 0) {
        syncManager.enqueueTagSync();
      }

      onProgress("complete", 100);

      return {
        success: true,
        importedClips,
        skippedClips,
        importedTags,
        skippedTags,
        importedSettings
      };

    } catch (err: any) {
      console.error("[ImportManager] Ingestion error:", err);
      return {
        success: false,
        importedClips: 0,
        skippedClips: 0,
        importedTags: 0,
        skippedTags: 0,
        importedSettings: false,
        error: err.message || "An unexpected error occurred during database import."
      };
    } finally {
      // 7. Cleanup temp folder
      this.cleanupTempDir(tempDir);
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
      console.warn(`[ImportManager] Failed to cleanup path ${dir}:`, e);
    } finally {
      this.activeTempDirs = this.activeTempDirs.filter((d) => d !== dir);
    }
  }
}

export const importManager = new ImportManager();
