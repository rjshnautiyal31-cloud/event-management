import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { SystemSetting } from "../models/SystemSetting.js";
import { SETTINGS_CATALOG, CATEGORIES } from "../config/settingsCatalog.js";
import { env, loadDbSettings, getDbSettingsCache } from "../config/env.js";
import { getStorageProvider, resetStorageAdapters, uploadAssetBuffer } from "../services/storage/index.js";

export const settingsRouter = Router();

// Protect all settings endpoints to super_admin and admin roles
settingsRouter.use(requireAuth, requireRole("super_admin", "admin"));

/**
 * GET /api/settings
 * Fetch all configurable settings with their effective values, sources (DB vs ENV), and metadata.
 */
settingsRouter.get("/", async (_req, res) => {
  try {
    const dbCache = getDbSettingsCache();
    const dbDocs = await SystemSetting.find({}).lean();
    const dbDocMap = {};
    for (const doc of dbDocs) {
      dbDocMap[doc.key] = doc;
    }

    const settings = SETTINGS_CATALOG.map((item) => {
      const dbDoc = dbDocMap[item.key];
      const hasDbValue = dbDoc && dbDoc.value !== undefined && dbDoc.value !== null && String(dbDoc.value).trim() !== "";
      const dbVal = hasDbValue ? dbDoc.value : null;

      // Check process.env fallback
      let envVal = null;
      let hasEnvValue = false;
      for (const k of item.envKeys) {
        if (process.env[k] !== undefined && process.env[k] !== null && String(process.env[k]).trim() !== "") {
          envVal = process.env[k];
          hasEnvValue = true;
          break;
        }
      }

      // Determine priority source
      let source = "default";
      let effectiveValue = item.defaultValue;

      if (hasDbValue) {
        source = "database";
        effectiveValue = dbVal;
      } else if (hasEnvValue) {
        source = "env";
        effectiveValue = envVal;
      }

      const isConfigured = Boolean(hasDbValue || hasEnvValue || (item.defaultValue && item.defaultValue !== ""));

      // Mask secrets for display
      let displayValue = effectiveValue;
      if (item.isSecret) {
        if (isConfigured && effectiveValue) {
          displayValue = "••••••••";
        } else {
          displayValue = "";
        }
      }

      return {
        key: item.key,
        category: item.category,
        label: item.label,
        description: item.description,
        type: item.type,
        options: item.options || [],
        isSecret: item.isSecret,
        source, // "database" | "env" | "default"
        hasDbValue,
        hasEnvValue,
        isConfigured,
        value: displayValue || "",
        updatedAt: dbDoc?.updatedAt || null
      };
    });

    res.json({
      categories: CATEGORIES,
      settings
    });
  } catch (error) {
    console.error("[Settings] GET error:", error);
    res.status(500).json({ message: "Failed to retrieve settings", error: error.message });
  }
});

/**
 * PUT /api/settings
 * Update settings in the database. First priority is given to DB configured values.
 */
settingsRouter.put("/", async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== "object") {
      return res.status(400).json({ message: "Invalid settings payload. Expected an object." });
    }

    const catalogMap = new Map(SETTINGS_CATALOG.map((s) => [s.key, s]));
    let updatedCount = 0;

    for (const [key, rawValue] of Object.entries(settings)) {
      const catalogItem = catalogMap.get(key);
      if (!catalogItem) continue; // ignore unknown keys

      const strVal = rawValue !== undefined && rawValue !== null ? String(rawValue).trim() : "";

      // If it's a secret and user kept the masked placeholder "••••••••", skip updating it
      if (catalogItem.isSecret && (strVal === "••••••••" || strVal === "")) {
        continue;
      }

      // Upsert into Database
      await SystemSetting.findOneAndUpdate(
        { key },
        {
          key,
          value: strVal,
          category: catalogItem.category,
          isSecret: catalogItem.isSecret,
          description: catalogItem.description,
          updatedBy: req.user.id || req.user.sub
        },
        { upsert: true, new: true }
      );
      updatedCount++;
    }

    // Refresh dynamic DB settings cache
    await loadDbSettings();

    // Reset singletons so changes take effect immediately
    resetStorageAdapters();

    res.json({
      message: "Settings saved successfully",
      updatedCount
    });
  } catch (error) {
    console.error("[Settings] PUT error:", error);
    res.status(500).json({ message: "Failed to save settings", error: error.message });
  }
});

/**
 * DELETE /api/settings/:key
 * Remove a database override for a specific setting key, reverting it back to .env fallback.
 */
settingsRouter.delete("/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const deleted = await SystemSetting.findOneAndDelete({ key });

    await loadDbSettings();
    resetStorageAdapters();

    if (!deleted) {
      return res.status(404).json({ message: `No database override found for ${key}` });
    }

    res.json({
      message: `Database override for ${key} removed. Reverted to .env fallback.`
    });
  } catch (error) {
    console.error("[Settings] DELETE error:", error);
    res.status(500).json({ message: "Failed to reset setting", error: error.message });
  }
});

/**
 * POST /api/settings/test-connection
 * Test connection for Cloud Storage or AI Provider using active configuration.
 */
settingsRouter.post("/test-connection", async (req, res) => {
  try {
    const { type } = req.body;

    if (type === "storage") {
      resetStorageAdapters();
      const storage = getStorageProvider();
      const testBuffer = Buffer.from(`Connection test at ${new Date().toISOString()}`);
      const testFilename = `test_connection_${Date.now()}.txt`;
      const testUrl = await uploadAssetBuffer(testBuffer, testFilename, "text/plain");

      return res.json({
        success: true,
        message: `Successfully connected to ${storage.name.toUpperCase()} storage provider!`,
        provider: storage.name,
        testUrl
      });
    }

    if (type === "ai") {
      const hasKey = Boolean(env.geminiApiKey && !env.geminiApiKey.includes("your_gemini_api_key_here"));
      const hasProject = Boolean(env.googleCloudProject);

      if (!hasKey && !hasProject) {
        return res.status(400).json({
          success: false,
          message: "Neither GEMINI_API_KEY nor GOOGLE_CLOUD_PROJECT is configured."
        });
      }

      return res.json({
        success: true,
        message: `AI credentials configured! LLM Provider: ${env.llmProvider}, Project: ${env.googleCloudProject}`,
        llmProvider: env.llmProvider,
        project: env.googleCloudProject
      });
    }

    res.status(400).json({ message: "Invalid test type. Supported: 'storage', 'ai'" });
  } catch (error) {
    console.error("[Settings] Test connection error:", error);
    res.status(500).json({
      success: false,
      message: `Connection test failed: ${error.message}`
    });
  }
});
