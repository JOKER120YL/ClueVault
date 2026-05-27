const { app } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { STATS_FILE_NAME } = require("./constants");

function getStatsPath() {
  return path.join(app.getPath("userData"), STATS_FILE_NAME);
}

function getTodayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getDefaultStats() {
  return {
    totalSubmissions: 0,
    dailyCounts: {}
  };
}

async function ensureStatsFile() {
  const filePath = getStatsPath();
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(getDefaultStats(), null, 2), "utf8");
  }
}

async function readStats() {
  await ensureStatsFile();
  const raw = await fs.readFile(getStatsPath(), "utf8");
  return {
    ...getDefaultStats(),
    ...JSON.parse(raw)
  };
}

async function writeStats(stats) {
  await fs.writeFile(getStatsPath(), JSON.stringify(stats, null, 2), "utf8");
  return stats;
}

async function recordSubmission(date = new Date()) {
  const stats = await readStats();
  const key = getTodayKey(date);
  const next = {
    ...stats,
    totalSubmissions: (stats.totalSubmissions || 0) + 1,
    dailyCounts: {
      ...stats.dailyCounts,
      [key]: (stats.dailyCounts?.[key] || 0) + 1
    }
  };

  await writeStats(next);
  return next;
}

async function getTodayCount(date = new Date()) {
  const stats = await readStats();
  return stats.dailyCounts?.[getTodayKey(date)] || 0;
}

module.exports = {
  ensureStatsFile,
  getTodayCount,
  getTodayKey,
  readStats,
  recordSubmission
};
