const { BrowserWindow, screen } = require("electron");
const { FLOATING_WINDOW_SIZE, getRendererFile, getRendererUrl } = require("./constants");

let mainWindow = null;
let floatingWindow = null;
let floatingDragState = null;

async function loadWindow(windowRef, pageName) {
  const devUrl = getRendererUrl(pageName);
  if (devUrl) {
    await windowRef.loadURL(devUrl);
  } else {
    await windowRef.loadFile(getRendererFile(pageName));
  }
}

function createMainWindow(preloadPath) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#f5efe4",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  loadWindow(mainWindow, "index.html");
  return mainWindow;
}

function createFloatingWindow(preloadPath) {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  floatingWindow = new BrowserWindow({
    width: FLOATING_WINDOW_SIZE,
    height: FLOATING_WINDOW_SIZE,
    x: Math.max(24, width - FLOATING_WINDOW_SIZE - 26),
    y: Math.max(24, height - FLOATING_WINDOW_SIZE - 140),
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    focusable: true,
    backgroundColor: "#00000000",
    roundedCorners: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  loadWindow(floatingWindow, "floating.html");
  return floatingWindow;
}

function getMainWindow() {
  return mainWindow;
}

function getFloatingWindow() {
  return floatingWindow;
}

function showMainWindow() {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function sendToMain(channel, payload) {
  if (mainWindow?.webContents) {
    mainWindow.webContents.send(channel, payload);
  }
}

function sendToFloating(channel, payload) {
  if (floatingWindow?.webContents) {
    floatingWindow.webContents.send(channel, payload);
  }
}

function syncFloatingVisibility(enabled) {
  if (!floatingWindow) {
    return;
  }

  if (enabled) {
    floatingWindow.showInactive();
  } else {
    floatingWindow.hide();
  }
}

function startFloatingDrag(cursorPoint) {
  if (!floatingWindow) {
    return;
  }

  const bounds = floatingWindow.getBounds();
  floatingDragState = {
    offsetX: cursorPoint.x - bounds.x,
    offsetY: cursorPoint.y - bounds.y
  };
}

function moveFloatingDrag(cursorPoint) {
  if (!floatingWindow || !floatingDragState) {
    return;
  }

  floatingWindow.setPosition(
    Math.round(cursorPoint.x - floatingDragState.offsetX),
    Math.round(cursorPoint.y - floatingDragState.offsetY)
  );
}

function endFloatingDrag() {
  floatingDragState = null;
}

module.exports = {
  createFloatingWindow,
  createMainWindow,
  endFloatingDrag,
  getFloatingWindow,
  getMainWindow,
  moveFloatingDrag,
  sendToFloating,
  sendToMain,
  startFloatingDrag,
  showMainWindow,
  syncFloatingVisibility
};
