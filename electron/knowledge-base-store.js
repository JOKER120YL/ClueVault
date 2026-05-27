const { app, dialog } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const KNOWLEDGE_FILE_NAME = "knowledge-base.json";

function getKnowledgePath() {
  return path.join(app.getPath("userData"), KNOWLEDGE_FILE_NAME);
}

function normalizeText(text) {
  return (text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function buildFingerprint(item) {
  return `${normalizeText(item.question)}||${normalizeText(item.answer)}`;
}

function getDefaultKnowledgeBase() {
  return {
    entries: [],
    meta: {
      lastExportAt: null,
      updatedAt: null
    }
  };
}

async function ensureKnowledgeBaseFile() {
  const filePath = getKnowledgePath();
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(getDefaultKnowledgeBase(), null, 2), "utf8");
  }
}

async function readKnowledgeBase() {
  await ensureKnowledgeBaseFile();
  const raw = await fs.readFile(getKnowledgePath(), "utf8");
  const parsed = JSON.parse(raw);
  return {
    ...getDefaultKnowledgeBase(),
    ...parsed,
    entries: Array.isArray(parsed.entries) ? parsed.entries : []
  };
}

async function writeKnowledgeBase(nextBase) {
  const payload = {
    ...getDefaultKnowledgeBase(),
    ...nextBase,
    meta: {
      ...getDefaultKnowledgeBase().meta,
      ...(nextBase.meta || {}),
      updatedAt: new Date().toISOString()
    }
  };
  await fs.writeFile(getKnowledgePath(), JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

async function mergeKnowledgeEntries(items, sourceLabel = "manual") {
  const base = await readKnowledgeBase();
  const existingByFingerprint = new Map(base.entries.map((entry) => [entry.fingerprint, entry]));
  let added = 0;
  let updated = 0;

  for (const item of items) {
    const fingerprint = buildFingerprint(item);
    if (!fingerprint || fingerprint === "||") {
      continue;
    }

    const now = new Date().toISOString();
    const nextEntry = {
      id: item.id || fingerprint,
      fingerprint,
      question: item.question || "",
      answer: item.answer || "",
      notes: item.notes || "",
      sourceLabel,
      createdAt: item.createdAt || now,
      updatedAt: now
    };

    const existing = existingByFingerprint.get(fingerprint);
    if (!existing) {
      existingByFingerprint.set(fingerprint, nextEntry);
      added += 1;
      continue;
    }

    if (normalizeText(nextEntry.notes) && normalizeText(nextEntry.notes) !== normalizeText(existing.notes)) {
      existingByFingerprint.set(fingerprint, {
        ...existing,
        notes: nextEntry.notes,
        updatedAt: now,
        sourceLabel
      });
      updated += 1;
    }
  }

  const nextBase = await writeKnowledgeBase({
    ...base,
    entries: Array.from(existingByFingerprint.values()).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
  });

  return {
    added,
    updated,
    total: nextBase.entries.length,
    entries: nextBase.entries,
    meta: nextBase.meta
  };
}

async function exportKnowledgeBase(mode = "full") {
  const base = await readKnowledgeBase();
  const exportSince = mode === "incremental" ? base.meta.lastExportAt : null;
  const entries =
    mode === "incremental" && exportSince
      ? base.entries.filter((entry) => (entry.updatedAt || entry.createdAt || "") > exportSince)
      : base.entries;

  const defaultFileName =
    mode === "incremental"
      ? `cluevault-knowledge-incremental-${new Date().toISOString().slice(0, 10)}.json`
      : `cluevault-knowledge-full-${new Date().toISOString().slice(0, 10)}.json`;

  const result = await dialog.showSaveDialog({
    title: mode === "incremental" ? "导出增量知识库" : "导出完整知识库",
    defaultPath: defaultFileName,
    filters: [{ name: "JSON", extensions: ["json"] }]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    mode,
    entries
  };

  await fs.writeFile(result.filePath, JSON.stringify(payload, null, 2), "utf8");

  if (mode === "incremental") {
    await writeKnowledgeBase({
      ...base,
      meta: {
        ...base.meta,
        lastExportAt: payload.exportedAt
      }
    });
  }

  return {
    canceled: false,
    filePath: result.filePath,
    count: entries.length
  };
}

async function importKnowledgeBase() {
  const result = await dialog.showOpenDialog({
    title: "导入知识库",
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }]
  });

  if (result.canceled || !result.filePaths?.[0]) {
    return { canceled: true };
  }

  const raw = await fs.readFile(result.filePaths[0], "utf8");
  const parsed = JSON.parse(raw);
  const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  const merged = await mergeKnowledgeEntries(entries, "import");

  return {
    canceled: false,
    filePath: result.filePaths[0],
    ...merged
  };
}

module.exports = {
  exportKnowledgeBase,
  importKnowledgeBase,
  mergeKnowledgeEntries,
  readKnowledgeBase
};
