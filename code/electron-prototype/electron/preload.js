const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("bugHelperApi", {
  getBootstrap: () => ipcRenderer.invoke("app:get-bootstrap"),
  saveConfig: (config) => ipcRenderer.invoke("config:save", config),
  testStoragePath: (storagePath) => ipcRenderer.invoke("storage:test", storagePath),
  pickAttachments: (role) => ipcRenderer.invoke("attachments:pick", role),
  attachmentsFromPaths: (filePaths) => ipcRenderer.invoke("attachments:from-paths", filePaths),
  attachmentsFromDataUrls: (payload) => ipcRenderer.invoke("attachments:from-data-urls", payload),
  extractPathsFromFiles: (files) => Array.from(files || []).map((file) => webUtils.getPathForFile(file)).filter(Boolean),
  generateDraft: (payload) => ipcRenderer.invoke("draft:generate", payload),
  organizeKnowledge: (payload) => ipcRenderer.invoke("knowledge:organize", payload),
  getKnowledgeLibrary: () => ipcRenderer.invoke("knowledge:get-library"),
  saveKnowledgeItems: (payload) => ipcRenderer.invoke("knowledge:save-items", payload),
  exportKnowledge: (mode) => ipcRenderer.invoke("knowledge:export", mode),
  importKnowledge: () => ipcRenderer.invoke("knowledge:import"),
  getSubmissionHistory: () => ipcRenderer.invoke("history:get"),
  updateSubmissionHistoryEntry: (payload) => ipcRenderer.invoke("history:update-entry", payload),
  submitBug: (payload) => ipcRenderer.invoke("bug:submit", payload),
  getWidgetState: () => ipcRenderer.invoke("widget:get-state"),
  getWidgetBootstrap: () => ipcRenderer.invoke("widget:get-bootstrap"),
  openMainFromWidget: () => ipcRenderer.invoke("widget:open-main"),
  dropFilesToWidget: (filePaths) => ipcRenderer.invoke("widget:drop-files", filePaths),
  confirmWidgetDrop: (discipline) => ipcRenderer.invoke("widget:confirm-drop", discipline),
  startWidgetDrag: (point) => ipcRenderer.invoke("widget:start-drag", point),
  moveWidgetDrag: (point) => ipcRenderer.invoke("widget:move-drag", point),
  endWidgetDrag: () => ipcRenderer.invoke("widget:end-drag"),
  resetTodayStats: () => ipcRenderer.invoke("stats:reset-today"),
  consumePendingAttachments: () => ipcRenderer.invoke("widget:consume-pending-attachments"),
  onWidgetFilesDropped: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("widget:files-dropped", handler);
    return () => ipcRenderer.removeListener("widget:files-dropped", handler);
  },
  onWidgetStateUpdated: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("widget:state-updated", handler);
    return () => ipcRenderer.removeListener("widget:state-updated", handler);
  },
  onWidgetDropReady: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("widget:drop-ready", handler);
    return () => ipcRenderer.removeListener("widget:drop-ready", handler);
  },
  onWidgetDropCleared: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("widget:drop-cleared", handler);
    return () => ipcRenderer.removeListener("widget:drop-cleared", handler);
  }
});
