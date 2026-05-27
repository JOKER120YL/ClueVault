const fs = require("node:fs/promises");
const path = require("node:path");
const { DISCIPLINE_OPTIONS } = require("./constants");

function normalizeTitle(title) {
  return title
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function buildFolderName(createdAt, projectName, title) {
  const date = new Date(createdAt).toISOString().slice(0, 10);
  const safeTitle = normalizeTitle(title || "未命名问题") || "未命名问题";
  const safeProject = normalizeTitle(projectName || "");
  return safeProject ? `${date}_${safeProject}_${safeTitle}` : `${date}_${safeTitle}`;
}

function renderMarkdownReport(payload) {
  const attachments = payload.attachments.length
    ? payload.attachments.map((item) => `- ${item.role}: ${item.name}`).join("\n")
    : "- 无";

  return [
    `# ${payload.titleDraft || "未命名问题"}`,
    "",
    `- 提交人: ${payload.submitter || "未填写"}`,
    `- 创建时间: ${new Date(payload.createdAt).toLocaleString("zh-CN", { hour12: false })}`,
    payload.projectName ? `- 项目名: ${payload.projectName}` : null,
    "",
    "## 问题摘要",
    payload.summaryDraft || "暂无摘要",
    "",
    "## 原始问题描述",
    payload.description || "暂无描述",
    "",
    "## AI 分析结论",
    payload.analysisDraft || "暂无分析结论",
    "",
    "## 附件清单",
    attachments,
    ""
  ]
    .filter(Boolean)
    .join("\n");
}

async function testStoragePath(storagePath) {
  const stat = await fs.stat(storagePath);
  if (!stat.isDirectory()) {
    throw new Error("目标路径不是文件夹。");
  }

  const testDir = path.join(storagePath, `.bug-helper-write-test-${Date.now()}`);
  await fs.mkdir(testDir);
  await fs.rm(testDir, { recursive: true, force: true });
  return true;
}

async function copyAttachmentList(targetDir, attachments) {
  for (const item of attachments) {
    await fs.copyFile(item.path, path.join(targetDir, item.name));
  }
}

async function submitBugToStorage({ config, payload, submitter }) {
  await testStoragePath(config.storagePath);
  const discipline = DISCIPLINE_OPTIONS.find((item) => item.id === payload.discipline);
  if (!discipline) {
    throw new Error("请选择问题所属专业。");
  }

  const disciplineDir = path.join(config.storagePath, discipline.folderName);
  await fs.mkdir(disciplineDir, { recursive: true });
  const folderName = buildFolderName(payload.createdAt, payload.projectName, payload.titleDraft);
  const targetDir = path.join(disciplineDir, folderName);
  await fs.mkdir(targetDir, { recursive: false });
  await copyAttachmentList(targetDir, payload.attachments);
  const report = renderMarkdownReport({
    ...payload,
    submitter
  });
  await fs.writeFile(path.join(targetDir, "说明.md"), report, "utf8");

  return {
    folderName,
    discipline: discipline.label,
    targetDir,
    submitter,
    attachmentCount: payload.attachments.length,
    reportCreated: true
  };
}

module.exports = {
  buildFolderName,
  normalizeTitle,
  renderMarkdownReport,
  submitBugToStorage,
  testStoragePath
};
