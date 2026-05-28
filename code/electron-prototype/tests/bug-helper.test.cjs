const test = require("node:test");
const assert = require("node:assert/strict");
const { buildFolderName, renderMarkdownReport } = require("../electron/bug-service");
const { inferRoleFromPath } = require("../electron/file-utils");
const { MODEL_EXTENSIONS } = require("../electron/constants");
const { getTodayKey } = require("../electron/submission-stats");

test("buildFolderName strips invalid characters and includes project", () => {
  const result = buildFolderName("2026-05-27T01:02:03.000Z", "Revit:导出", "楼梯/栏杆?丢失");
  assert.equal(result, "2026-05-27_Revit 导出_楼梯 栏杆 丢失");
});

test("renderMarkdownReport includes submitter and attachments", () => {
  const report = renderMarkdownReport({
    titleDraft: "楼梯丢失",
    submitter: "小陈",
    createdAt: "2026-05-27T01:02:03.000Z",
    projectName: "Revit 导出",
    summaryDraft: "摘要",
    description: "问题描述",
    analysisDraft: "分析",
    attachments: [{ role: "model", name: "demo.rvt" }]
  });

  assert.match(report, /提交人: 小陈/);
  assert.match(report, /- model: demo\.rvt/);
  assert.match(report, /## 问题摘要/);
});

test("inferRoleFromPath recognizes model and image file extensions", () => {
  assert.equal(inferRoleFromPath("C:\\demo\\sample.rvt"), "model");
  assert.equal(inferRoleFromPath("C:\\demo\\issue.eb"), "model");
  assert.equal(inferRoleFromPath("C:\\demo\\shot.png"), "image");
  assert.equal(inferRoleFromPath("C:\\demo\\notes.txt"), "other");
});

test("model extensions include eb", () => {
  assert.equal(MODEL_EXTENSIONS.includes("eb"), true);
});

test("getTodayKey uses local calendar date", () => {
  const result = getTodayKey(new Date(2026, 4, 27, 0, 30, 0));
  assert.equal(result, "2026-05-27");
});
