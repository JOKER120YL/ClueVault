const { app } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const {
  CONFIG_FILE_NAME,
  DEFAULT_BEE_SWITCH_THRESHOLD,
  DEFAULT_MODEL,
  DEFAULT_STORAGE_PATH,
  PROVIDER_PRESETS
} = require("./constants");

function getConfigPath() {
  return path.join(app.getPath("userData"), CONFIG_FILE_NAME);
}

function getDefaultConfig() {
  return {
    displayName: "",
    storagePath: DEFAULT_STORAGE_PATH,
    provider: PROVIDER_PRESETS[0].id,
    baseUrl: PROVIDER_PRESETS[0].defaultBaseUrl,
    model: DEFAULT_MODEL,
    apiKey: "",
    supportsVision: false,
    beeSwitchThreshold: DEFAULT_BEE_SWITCH_THRESHOLD,
    floatingWidgetEnabled: true
  };
}

async function ensureConfigFile() {
  const filePath = getConfigPath();
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(getDefaultConfig(), null, 2), "utf8");
  }
}

async function readConfig() {
  await ensureConfigFile();
  const raw = await fs.readFile(getConfigPath(), "utf8");
  return {
    ...getDefaultConfig(),
    ...JSON.parse(raw)
  };
}

async function writeConfig(nextConfig) {
  const payload = {
    ...getDefaultConfig(),
    ...nextConfig,
    displayName: (nextConfig.displayName || "").trim(),
    storagePath: (nextConfig.storagePath || "").trim(),
    baseUrl: (nextConfig.baseUrl || "").trim(),
    model: (nextConfig.model || "").trim(),
    apiKey: (nextConfig.apiKey || "").trim(),
    supportsVision: nextConfig.supportsVision === true,
    beeSwitchThreshold: Math.max(1, Number(nextConfig.beeSwitchThreshold) || DEFAULT_BEE_SWITCH_THRESHOLD),
    floatingWidgetEnabled: nextConfig.floatingWidgetEnabled !== false
  };

  await fs.writeFile(getConfigPath(), JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

module.exports = {
  ensureConfigFile,
  getDefaultConfig,
  readConfig,
  writeConfig
};
