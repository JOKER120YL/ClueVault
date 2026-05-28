const { app, dialog, ipcMain } = require("electron");
const path = require("node:path");
const { submitBugToStorage, testStoragePath } = require("./bug-service");
const { ensureConfigFile, readConfig, writeConfig } = require("./config-store");
const { PROVIDER_PRESETS, DEFAULT_STORAGE_PATH, DISCIPLINE_OPTIONS, IMAGE_EXTENSIONS, MODEL_EXTENSIONS } = require("./constants");
const { generateDraft } = require("./draft-service");
const { dataUrlToAttachment, toAttachment, uniqueByPath } = require("./file-utils");
const { organizeKnowledge } = require("./knowledge-service");
const {
  exportKnowledgeBase,
  importKnowledgeBase,
  mergeKnowledgeEntries,
  readKnowledgeBase
} = require("./knowledge-base-store");
const { ensureStatsFile, getTodayCount, recordSubmission, resetTodayCount } = require("./submission-stats");
const { addSubmissionHistoryEntry, readHistory, updateSubmissionHistoryEntry } = require("./submission-history-store");
const {
  createFloatingWindow,
  createMainWindow,
  endFloatingDrag,
  getMainWindow,
  moveFloatingDrag,
  sendToMain,
  sendToFloating,
  setFloatingMenuExpanded,
  startFloatingDrag,
  showMainWindow,
  syncFloatingVisibility
} = require("./window-manager");

const preloadPath = path.join(__dirname, "preload.js");
let pendingAttachments = [];
let pendingWidgetDrop = null;

function buildWidgetState(config, todayCount) {
  const threshold = Math.max(1, Number(config.beeSwitchThreshold) || 1);
  const isBeeMode = todayCount >= threshold;
  return {
    todayCount,
    threshold,
    currentAvatar: isBeeMode ? "bee" : "frog",
    enabled: config.floatingWidgetEnabled !== false,
    hint: isBeeMode ? "蜂哥上线，今天已经收了不少反馈。" : "蛙弟待命中，可以直接拖文件过来。"
  };
}

async function getBootstrapPayload() {
  const config = await readConfig();
  const todayCount = await getTodayCount();
  return {
    config,
    disciplineOptions: DISCIPLINE_OPTIONS,
    providerPresets: PROVIDER_PRESETS,
    defaults: {
      storagePath: DEFAULT_STORAGE_PATH,
      beeSwitchThreshold: 1
    },
    widgetState: buildWidgetState(config, todayCount),
    pendingAttachments,
    submissionHistory: await readHistory()
  };
}

async function refreshWidgetState() {
  const config = await readConfig();
  const todayCount = await getTodayCount();
  const widgetState = buildWidgetState(config, todayCount);
  syncFloatingVisibility(widgetState.enabled);
  sendToFloating("widget:state-updated", widgetState);
  return widgetState;
}

async function handleDroppedFiles(filePaths) {
  const attachments = uniqueByPath([...pendingAttachments, ...filePaths.map(toAttachment)]);
  pendingAttachments = attachments;
  pendingWidgetDrop = null;
  setFloatingMenuExpanded(false);
  showMainWindow();
  const payload = {
    attachments,
    source: "floating-widget"
  };
  const mainWindow = getMainWindow();
  if (mainWindow?.webContents.isLoading()) {
    mainWindow.webContents.once("did-finish-load", () => {
      sendToMain("widget:files-dropped", payload);
    });
  } else {
    sendToMain("widget:files-dropped", payload);
  }
  sendToFloating("widget:drop-cleared", { ok: true });
  return { count: attachments.length };
}

ipcMain.handle("app:get-bootstrap", async () => getBootstrapPayload());

ipcMain.handle("config:save", async (_event, nextConfig) => {
  if (!nextConfig.displayName?.trim()) {
    throw new Error("姓名或昵称不能为空。");
  }

  if (!nextConfig.storagePath?.trim()) {
    throw new Error("共享目录不能为空。");
  }

  const saved = await writeConfig(nextConfig);
  await refreshWidgetState();
  return saved;
});

ipcMain.handle("storage:test", async (_event, storagePath) => {
  if (!storagePath?.trim()) {
    throw new Error("请先填写共享目录。");
  }

  await testStoragePath(storagePath.trim());
  return { ok: true };
});

ipcMain.handle("attachments:pick", async (_event, role) => {
  const filters =
    role === "image"
      ? [{ name: "Images", extensions: IMAGE_EXTENSIONS }]
      : role === "model"
        ? [{ name: "Model Files", extensions: MODEL_EXTENSIONS }]
        : [];

  const result = await dialog.showOpenDialog(getMainWindow(), {
    title: role === "image" ? "选择图片" : role === "model" ? "选择模型文件" : "选择附件",
    properties: ["openFile", "multiSelections"],
    filters
  });

  if (result.canceled) {
    return [];
  }

  return result.filePaths.map(toAttachment);
});

ipcMain.handle("attachments:from-paths", async (_event, filePaths) => {
  return uniqueByPath((filePaths || []).map(toAttachment));
});

ipcMain.handle("attachments:from-data-urls", async (_event, payload) => {
  const items = await Promise.all((payload || []).map((item, index) => dataUrlToAttachment(item, `clipboard-${index + 1}`)));
  return uniqueByPath(items);
});

ipcMain.handle("draft:generate", async (_event, payload) => {
  const config = await readConfig();
  if (!payload.description?.trim()) {
    throw new Error("请先填写问题描述。");
  }

  return generateDraft({ config, payload });
});

ipcMain.handle("knowledge:organize", async (_event, payload) => {
  const config = await readConfig();
  return organizeKnowledge({ config, payload });
});

ipcMain.handle("knowledge:get-library", async () => readKnowledgeBase());
ipcMain.handle("knowledge:save-items", async (_event, payload) => mergeKnowledgeEntries(payload.items || [], payload.sourceLabel || "manual"));
ipcMain.handle("knowledge:export", async (_event, mode) => exportKnowledgeBase(mode));
ipcMain.handle("knowledge:import", async () => importKnowledgeBase());
ipcMain.handle("history:get", async () => readHistory());
ipcMain.handle("history:update-entry", async (_event, payload) => {
  const entries = await updateSubmissionHistoryEntry(payload.id, payload);
  return { entries };
});

ipcMain.handle("bug:submit", async (_event, payload) => {
  const config = await readConfig();
  if (!payload.attachments?.length) {
    throw new Error("请至少添加一个附件再上传。");
  }

  const submitter = (payload.submitter || config.displayName || "").trim();
  if (!submitter) {
    throw new Error("提交人不能为空，请先在设置中填写姓名或昵称。");
  }

  if (!config.storagePath?.trim()) {
    throw new Error("共享目录未配置。");
  }

  const result = await submitBugToStorage({
    config,
    payload,
    submitter
  });

  pendingAttachments = [];
  await recordSubmission();
  const widgetState = await refreshWidgetState();
  const discipline = DISCIPLINE_OPTIONS.find((item) => item.id === payload.discipline);
  const historyEntries = await addSubmissionHistoryEntry({
    titleDraft: payload.titleDraft || payload.description || "未命名问题",
    summaryDraft: payload.summaryDraft || "",
    analysisDraft: payload.analysisDraft || "",
    description: payload.description || "",
    projectName: payload.projectName || "",
    discipline: payload.discipline,
    disciplineLabel: discipline?.label || "",
    submitter,
    createdAt: payload.createdAt,
    targetDir: result.targetDir,
    attachments: payload.attachments || []
  });

  return {
    ...result,
    widgetState,
    historyEntries
  };
});

ipcMain.handle("widget:get-state", async () => {
  const config = await readConfig();
  return buildWidgetState(config, await getTodayCount());
});

ipcMain.handle("widget:get-bootstrap", async () => ({
  disciplineOptions: DISCIPLINE_OPTIONS
}));

ipcMain.handle("widget:open-main", async () => {
  showMainWindow();
  return { ok: true };
});

ipcMain.handle("widget:drop-files", async (_event, filePaths) => handleDroppedFiles(filePaths));
ipcMain.handle("widget:confirm-drop", async (_event, discipline) => {
  if (!pendingWidgetDrop) {
    return { ok: false };
  }

  const payload = {
    attachments: pendingWidgetDrop.attachments,
    source: "floating-widget",
    discipline
  };
  pendingAttachments = pendingWidgetDrop.attachments;
  pendingWidgetDrop = null;
  setFloatingMenuExpanded(false);
  showMainWindow();
  const mainWindow = getMainWindow();
  if (mainWindow?.webContents.isLoading()) {
    mainWindow.webContents.once("did-finish-load", () => {
      mainWindow.webContents.send("widget:files-dropped", payload);
    });
  } else {
    mainWindow?.webContents.send("widget:files-dropped", payload);
  }
  sendToFloating("widget:drop-cleared", { ok: true });
  return { ok: true };
});
ipcMain.handle("stats:reset-today", async () => {
  await resetTodayCount();
  const widgetState = await refreshWidgetState();
  return widgetState;
});
ipcMain.handle("widget:start-drag", async (_event, point) => {
  startFloatingDrag(point);
  return { ok: true };
});
ipcMain.handle("widget:move-drag", async (_event, point) => {
  moveFloatingDrag(point);
  return { ok: true };
});
ipcMain.handle("widget:end-drag", async () => {
  endFloatingDrag();
  return { ok: true };
});

ipcMain.handle("widget:consume-pending-attachments", async () => {
  const output = pendingAttachments;
  pendingAttachments = [];
  return output;
});

app.whenReady().then(async () => {
  await ensureConfigFile();
  await ensureStatsFile();
  createMainWindow(preloadPath);
  createFloatingWindow(preloadPath);
  await refreshWidgetState();

  app.on("activate", () => {
    if (!getMainWindow()) {
      createMainWindow(preloadPath);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
