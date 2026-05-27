const path = require("node:path");

const DEFAULT_STORAGE_PATH = "\\\\server\\share\\bug-collect";
const CONFIG_FILE_NAME = "config.json";
const STATS_FILE_NAME = "submission-stats.json";
const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_BEE_SWITCH_THRESHOLD = 1;
const FLOATING_WINDOW_SIZE = 148;
const DISCIPLINE_OPTIONS = [
  { id: "architecture", label: "建筑", folderName: "建筑" },
  { id: "structure", label: "结构", folderName: "结构" },
  { id: "hvac", label: "暖通", folderName: "暖通" },
  { id: "plumbing", label: "给排水", folderName: "给排水" },
  { id: "electrical", label: "电气", folderName: "电气" },
  { id: "other", label: "其他 / 平台", folderName: "其他" }
];

const PROVIDER_PRESETS = [
  {
    id: "deepseek",
    label: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    supportsOpenAICompatible: true
  },
  {
    id: "openai-compatible",
    label: "自定义 OpenAI 兼容接口",
    defaultBaseUrl: "https://api.openai.com/v1",
    supportsOpenAICompatible: true
  }
];

const MODEL_EXTENSIONS = ["rvt", "rfa", "ifc", "skp", "dwg", "nwd", "fbx", "obj", "3dm", "eb", "zip"];
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "bmp", "webp", "gif"];

function getRendererUrl(pageName = "index.html") {
  if (!process.env.VITE_DEV_SERVER_URL) {
    return null;
  }

  if (pageName === "index.html") {
    return process.env.VITE_DEV_SERVER_URL;
  }

  return `${process.env.VITE_DEV_SERVER_URL.replace(/\/$/, "")}/${pageName}`;
}

function getRendererFile(pageName = "index.html") {
  return path.join(__dirname, "..", "dist", pageName);
}

module.exports = {
  CONFIG_FILE_NAME,
  DEFAULT_BEE_SWITCH_THRESHOLD,
  DEFAULT_MODEL,
  DEFAULT_STORAGE_PATH,
  DISCIPLINE_OPTIONS,
  FLOATING_WINDOW_SIZE,
  IMAGE_EXTENSIONS,
  MODEL_EXTENSIONS,
  PROVIDER_PRESETS,
  STATS_FILE_NAME,
  getRendererFile,
  getRendererUrl
};
