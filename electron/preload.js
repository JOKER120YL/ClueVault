const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bugHelperApi", {
  getBootstrap: () => ipcRenderer.invoke("app:get-bootstrap"),
  saveConfig: (config) => ipcRenderer.invoke("config:save", config),
  testStoragePath: (storagePath) => ipcRenderer.invoke("storage:test", storagePath),
  pickAttachments: (role) => ipcRenderer.invoke("attachments:pick", role),
  attachmentsFromPaths: (filePaths) => ipcRenderer.invoke("attachments:from-paths", filePaths),
  generateDraft: (payload) => ipcRenderer.invoke("draft:generate", payload),
  submitBug: (payload) => ipcRenderer.invoke("bug:submit", payload),
  getWidgetState: () => ipcRenderer.invoke("widget:get-state"),
  openMainFromWidget: () => ipcRenderer.invoke("widget:open-main"),
  dropFilesToWidget: (filePaths) => ipcRenderer.invoke("widget:drop-files", filePaths),
  startWidgetDrag: (point) => ipcRenderer.invoke("widget:start-drag", point),
  moveWidgetDrag: (point) => ipcRenderer.invoke("widget:move-drag", point),
  endWidgetDrag: () => ipcRenderer.invoke("widget:end-drag"),
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
  }
});
