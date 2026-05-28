const { app } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { renderMarkdownReport } = require("./bug-service");

const HISTORY_FILE_NAME = "submission-history.json";

function getHistoryPath() {
  return path.join(app.getPath("userData"), HISTORY_FILE_NAME);
}

function getDefaultHistory() {
  return {
    entries: []
  };
}

async function ensureHistoryFile() {
  const filePath = getHistoryPath();
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(getDefaultHistory(), null, 2), "utf8");
  }
}

async function readHistory() {
  await ensureHistoryFile();
  const raw = await fs.readFile(getHistoryPath(), "utf8");
  const parsed = JSON.parse(raw);
  return {
    ...getDefaultHistory(),
    ...parsed,
    entries: Array.isArray(parsed.entries) ? parsed.entries : []
  };
}

async function writeHistory(nextHistory) {
  const payload = {
    ...getDefaultHistory(),
    ...nextHistory,
    entries: Array.isArray(nextHistory.entries) ? nextHistory.entries : []
  };
  await fs.writeFile(getHistoryPath(), JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

async function addSubmissionHistoryEntry(entry) {
  const history = await readHistory();
  const nextEntry = {
    id: entry.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...entry
  };
  const nextHistory = await writeHistory({
    ...history,
    entries: [nextEntry, ...history.entries].slice(0, 120)
  });
  return nextHistory.entries;
}

async function updateSubmissionHistoryEntry(entryId, updates) {
  const history = await readHistory();
  const index = history.entries.findIndex((item) => item.id === entryId);
  if (index === -1) {
    throw new Error("未找到这条上传记录。");
  }

  const current = history.entries[index];
  const nextEntry = {
    ...current,
    projectName: updates.projectName ?? current.projectName,
    description: updates.description ?? current.description,
    titleDraft: (updates.description || current.description || current.titleDraft || "未命名问题").trim(),
    updatedAt: new Date().toISOString()
  };

  const report = renderMarkdownReport(nextEntry);
  await fs.writeFile(path.join(nextEntry.targetDir, "说明.md"), report, "utf8");

  const nextEntries = [...history.entries];
  nextEntries[index] = nextEntry;
  const nextHistory = await writeHistory({
    ...history,
    entries: nextEntries.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
  });

  return nextHistory.entries;
}

module.exports = {
  addSubmissionHistoryEntry,
  readHistory,
  updateSubmissionHistoryEntry
};
