const state = {
  configured: true,
  submitCount: 0,
  files: [],
  records: [],
  knowledge: [],
  screenshotEnabled: false,
  screenshotCaptured: false,
  mascotThreshold: 1,
  lastResult: null,
  selectedDiscipline: "",
  editingRecordId: null,
};

const views = {
  archive: document.querySelector("#archiveView"),
  records: document.querySelector("#recordsView"),
  knowledge: document.querySelector("#knowledgeView"),
  settings: document.querySelector("#settingsView"),
};

const titles = {
  archive: "快速归档",
  records: "今日归档记录",
  knowledge: "经验库",
  settings: "配置中心",
};

const els = {
  viewTitle: document.querySelector("#viewTitle"),
  configStatus: document.querySelector("#configStatus"),
  fileList: document.querySelector("#fileList"),
  fileCount: document.querySelector("#fileCount"),
  dropZone: document.querySelector("#dropZone"),
  disciplineGrid: document.querySelector("#disciplineGrid"),
  projectName: document.querySelector("#projectName"),
  sourceName: document.querySelector("#sourceName"),
  archiveNote: document.querySelector("#archiveNote"),
  simulateShareFailure: document.querySelector("#simulateShareFailure"),
  archiveButton: document.querySelector("#archiveButton"),
  archiveMessage: document.querySelector("#archiveMessage"),
  quickArchivePanel: document.querySelector("#quickArchivePanel"),
  screenshotEnabled: document.querySelector("#screenshotEnabled"),
  screenshotStep: document.querySelector("#screenshotStep"),
  screenshotStatus: document.querySelector("#screenshotStatus"),
  captureScreenshotButton: document.querySelector("#captureScreenshotButton"),
  resultCard: document.querySelector("#resultCard"),
  operatorName: document.querySelector("#operatorName"),
  shareRoot: document.querySelector("#shareRoot"),
  disciplinesInput: document.querySelector("#disciplinesInput"),
  settingsMessage: document.querySelector("#settingsMessage"),
  recordsTable: document.querySelector("#recordsTable"),
  knowledgeKeyword: document.querySelector("#knowledgeKeyword"),
  knowledgeScene: document.querySelector("#knowledgeScene"),
  knowledgeContent: document.querySelector("#knowledgeContent"),
  knowledgeMessage: document.querySelector("#knowledgeMessage"),
  knowledgeList: document.querySelector("#knowledgeList"),
  knowledgeCount: document.querySelector("#knowledgeCount"),
  floatingWidget: document.querySelector("#floatingWidget"),
  floatingCount: document.querySelector("#floatingCount"),
  floatingStatus: document.querySelector("#floatingStatus"),
  previewCount: document.querySelector("#previewCount"),
  previewStatus: document.querySelector("#previewStatus"),
  previewMascot: document.querySelector("#previewMascot"),
  floatingMascot: document.querySelector("#floatingMascot"),
  toggleFloatButton: document.querySelector("#toggleFloatButton"),
  mascotThreshold: document.querySelector("#mascotThreshold"),
  noteDrawer: document.querySelector("#noteDrawer"),
  recordNoteEditor: document.querySelector("#recordNoteEditor"),
  noteMessage: document.querySelector("#noteMessage"),
};

const mascotAssets = {
  frog: {
    src: "../ClueVault.Desktop/Assets/frogdi-confused-final.png",
    alt: "蛙弟形象",
  },
  bee: {
    src: "../ClueVault.Desktop/Assets/ebee-angry-final.png",
    alt: "蜂哥形象",
  },
};

function showView(name) {
  Object.entries(views).forEach(([key, view]) => {
    view.classList.toggle("active", key === name);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name);
  });
  els.viewTitle.textContent = titles[name];
}

function setMessage(element, type, text) {
  element.className = `message ${type}`;
  element.textContent = text;
}

let toastTimer;

function showToast(type, text) {
  window.clearTimeout(toastTimer);
  els.archiveMessage.className = `toast show ${type}`;
  els.archiveMessage.textContent = text;
  toastTimer = window.setTimeout(() => {
    els.archiveMessage.className = "toast";
    els.archiveMessage.textContent = "";
  }, 1800);
}

function renderFiles() {
  els.fileList.innerHTML = "";
  state.files.forEach((file, index) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <span>${file.name}</span>
      <small>${file.type}</small>
      <button class="remove-file" type="button" aria-label="移除 ${file.name}">移除</button>
    `;
    item.querySelector("button").addEventListener("click", () => {
      state.files.splice(index, 1);
      renderFiles();
      showToast("neutral", "待归档文件已更新。");
    });
    els.fileList.appendChild(item);
  });
  els.fileCount.textContent = `${state.files.length} 个`;
  syncArchiveButton();
  renderScreenshotStep();
}

function openQuickPanel() {
  els.quickArchivePanel.classList.add("open");
  els.quickArchivePanel.setAttribute("aria-hidden", "false");
  renderScreenshotStep();
}

function closeQuickPanel() {
  els.quickArchivePanel.classList.remove("open");
  els.quickArchivePanel.setAttribute("aria-hidden", "true");
}

function addMockFile(type) {
  const next = state.files.length + 1;
  const samples = {
    model: { name: `user-model-${next}.rvt`, type: "模型" },
    zip: { name: `user-files-${next}.zip`, type: "压缩包" },
    image: { name: `screenshot-${next}.png`, type: "截图" },
    drop: { name: `wechat-model-${next}.ifc`, type: "拖入文件" },
  };
  state.files.push(samples[type] || samples.model);
  renderFiles();
}

function promptScreenshotIfEnabled() {
  if (!state.screenshotEnabled) return;
  state.screenshotCaptured = false;
  renderScreenshotStep();
}

function cleanName(value, fallback) {
  return (value || fallback)
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim() || fallback;
}

function validateArchive() {
  if (!state.files.length) {
    showToast("error", "没有待归档文件。请先拖入或添加文件。");
    return false;
  }
  if (!state.selectedDiscipline) {
    showToast("error", "请选择归档专业。");
    return false;
  }
  if (!els.operatorName.value.trim() || !els.shareRoot.value.trim()) {
    showToast("error", "配置不完整。请先填写姓名和共享盘根目录。");
    closeQuickPanel();
    showView("settings");
    return false;
  }
  return true;
}

function selectDiscipline(value) {
  state.selectedDiscipline = value;
  document.querySelectorAll(".discipline-option").forEach((button) => {
    const selected = button.dataset.discipline === value;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-checked", selected ? "true" : "false");
  });
  syncArchiveButton();
}

function syncArchiveButton() {
  els.archiveButton.disabled = !state.files.length || !state.selectedDiscipline;
}

function updateMascot() {
  const value = state.submitCount >= state.mascotThreshold ? "bee" : "frog";
  const asset = mascotAssets[value] || mascotAssets.frog;
  els.previewMascot.src = asset.src;
  els.previewMascot.alt = asset.alt;
  els.floatingMascot.src = asset.src;
  els.floatingMascot.alt = asset.alt;
}

function nowParts() {
  return {
    date: "2026-05-27",
    time: "23:10",
    compactTime: "2310",
  };
}

function archiveFiles() {
  if (!validateArchive()) return;

  const { date, time, compactTime } = nowParts();
  const discipline = state.selectedDiscipline;
  const operator = cleanName(els.operatorName.value, "未知提交人");
  const project = cleanName(els.projectName.value, "用户模型");
  const folderName = `${date}_${compactTime}_${operator}_${project}`;
  const targetPath = `${els.shareRoot.value}\\${discipline}\\${folderName}`;

  if (els.simulateShareFailure.checked) {
    state.lastResult = {
      ok: false,
      time,
      discipline,
      project,
      source: els.sourceName.value.trim(),
      note: els.archiveNote.value.trim(),
      fileCount: state.files.length,
      reason: "共享盘不可写",
      advice: "检查网络、权限，或到配置中心更换共享盘根目录。",
    };
    state.records.unshift({
      id: crypto.randomUUID(),
      time,
      discipline,
      project,
      source: els.sourceName.value.trim(),
      note: els.archiveNote.value.trim(),
      folderName,
      targetPath,
      fileCount: state.files.length,
      ok: false,
    });
    renderResult();
    renderRecords();
    showToast("error", "归档失败：共享盘不可写。待归档文件已保留。");
    return;
  }

  state.submitCount += 1;
  state.lastResult = {
    ok: true,
    time,
    discipline,
    folderName,
    targetPath,
    operator,
    project,
    source: els.sourceName.value.trim(),
    note: els.archiveNote.value.trim(),
    fileCount: state.files.length,
  };
  state.records.unshift({
    id: crypto.randomUUID(),
    time,
    discipline,
    project,
    source: els.sourceName.value.trim(),
    note: els.archiveNote.value.trim(),
    folderName,
    targetPath,
    fileCount: state.files.length,
    ok: true,
  });
  state.files = [];
  renderFiles();
  renderResult();
  renderRecords();
  updateFloatingCount();
  showToast("success", "归档成功：已生成模拟结果。");
}

function renderResult() {
  if (!state.lastResult) return;

  if (!state.lastResult.ok) {
    els.resultCard.innerHTML = `
      <div class="message error">归档失败。待归档文件已保留，可修复后重试。</div>
      <dl class="result-list">
        <div><dt>专业</dt><dd>${state.lastResult.discipline}</dd></div>
        <div><dt>失败原因</dt><dd>${state.lastResult.reason}</dd></div>
        <div><dt>建议动作</dt><dd>${state.lastResult.advice}</dd></div>
        <div><dt>文件数量</dt><dd>${state.lastResult.fileCount}</dd></div>
      </dl>
      <div class="action-row">
        <button class="button secondary" type="button" data-view-jump="settings">打开配置中心</button>
      </div>
    `;
    return;
  }

  els.resultCard.innerHTML = `
    <div class="message success">归档成功。以下为模拟共享盘结果。</div>
    <dl class="result-list">
      <div><dt>专业</dt><dd>${state.lastResult.discipline}</dd></div>
      <div><dt>目录名</dt><dd>${state.lastResult.folderName}</dd></div>
      <div><dt>位置</dt><dd>${state.lastResult.targetPath}</dd></div>
      <div><dt>提交人</dt><dd>${state.lastResult.operator}</dd></div>
      <div><dt>文件数量</dt><dd>${state.lastResult.fileCount}</dd></div>
      <div><dt>归档信息</dt><dd>已生成 归档信息.md</dd></div>
    </dl>
    <div class="action-row">
      <button class="button secondary" type="button" data-view-jump="records">查看今日记录</button>
    </div>
  `;
}

function renderRecords() {
  if (!state.records.length) {
    els.recordsTable.innerHTML = `
      <tr>
        <td colspan="8">暂无归档记录。可以先通过悬浮窗模拟拖入文件。</td>
      </tr>
    `;
    return;
  }

  els.recordsTable.innerHTML = state.records.map((record) => `
    <tr>
      <td>${record.time}</td>
      <td>${record.discipline}</td>
      <td>${record.project || "用户模型"}</td>
      <td>${record.source || "-"}</td>
      <td>${record.note || "-"}</td>
      <td>${record.fileCount}</td>
      <td><span class="status-text ${record.ok ? "success" : "error"}">${record.ok ? "成功" : "失败"}</span></td>
      <td>
        <button class="button ghost small" type="button" data-edit-note="${record.id}">改备注</button>
      </td>
    </tr>
  `).join("");
}

function resetArchive() {
  state.files = [];
  state.screenshotCaptured = false;
  selectDiscipline("");
  els.projectName.value = "";
  els.sourceName.value = "";
  els.archiveNote.value = "";
  renderFiles();
  renderScreenshotStep();
  els.resultCard.innerHTML = `
    <div class="empty-state">
      <strong>等待归档</strong>
      <p>归档成功或失败后，这里会显示模拟结果。</p>
    </div>
  `;
  showToast("neutral", "已清空快速归档面板。");
}

function updateFloatingCount() {
  els.floatingCount.textContent = `今日已归档：${state.submitCount}`;
  els.previewCount.textContent = `今日已归档：${state.submitCount}`;
  els.floatingStatus.textContent = state.submitCount > 0 ? "继续拖入模型归档" : "拖入模型快速归档";
  els.previewStatus.textContent = els.floatingStatus.textContent;
  updateMascot();
}

function renderScreenshotStep() {
  els.screenshotStep.classList.toggle("visible", state.screenshotEnabled);
  if (!state.screenshotEnabled) {
    els.screenshotStatus.textContent = "设置未开启，当前不提示截图。";
    return;
  }
  els.screenshotStatus.textContent = state.screenshotCaptured
    ? "已添加聊天截图，将一并归档。"
    : "已开启。可框选微信群反馈截图，也可以跳过。";
}

function renderKnowledge() {
  els.knowledgeCount.textContent = `${state.knowledge.length} 条`;
  if (!state.knowledge.length) {
    els.knowledgeList.innerHTML = `
      <li>
        <strong>暂无经验草稿</strong>
        <small>遇到可复用回复时，可以在这里单独记录。</small>
      </li>
    `;
    return;
  }

  els.knowledgeList.innerHTML = state.knowledge.map((item) => `
    <li>
      <strong>${item.keyword}</strong>
      <small>${item.scene}</small>
      <span>${item.content}</span>
    </li>
  `).join("");
}

function openNoteEditor(recordId) {
  const record = state.records.find((item) => item.id === recordId);
  if (!record) return;
  state.editingRecordId = recordId;
  els.recordNoteEditor.value = record.note || "";
  setMessage(els.noteMessage, "neutral", `将模拟同步到：${record.targetPath || "对应归档目录"}\\归档信息.md`);
  els.noteDrawer.classList.add("open");
  els.noteDrawer.setAttribute("aria-hidden", "false");
}

function closeNoteEditor() {
  els.noteDrawer.classList.remove("open");
  els.noteDrawer.setAttribute("aria-hidden", "true");
}

function saveRecordNote() {
  const record = state.records.find((item) => item.id === state.editingRecordId);
  if (!record) return;
  record.note = els.recordNoteEditor.value.trim();
  if (state.lastResult && state.lastResult.folderName === record.folderName) {
    state.lastResult.note = record.note;
  }
  renderRecords();
  setMessage(els.noteMessage, "success", "备注已更新，并已模拟同步到归档信息.md。");
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

document.body.addEventListener("click", (event) => {
  const jump = event.target.closest("[data-view-jump]");
  if (jump) showView(jump.dataset.viewJump);
});

document.querySelectorAll("[data-add-file]").forEach((button) => {
  button.addEventListener("click", () => {
    addMockFile(button.dataset.addFile);
    showToast("success", "已添加模拟文件。");
  });
});

document.querySelectorAll(".discipline-option").forEach((button) => {
  button.addEventListener("click", () => {
    selectDiscipline(button.dataset.discipline);
    showToast("neutral", `已选择：${button.dataset.discipline}`);
  });
});

["dragover", "drop"].forEach((eventName) => {
  els.dropZone.addEventListener(eventName, (event) => event.preventDefault());
  els.floatingWidget.addEventListener(eventName, (event) => event.preventDefault());
});

els.dropZone.addEventListener("dragover", () => {
  els.dropZone.classList.add("dragging");
  els.floatingWidget.classList.add("drag-mouth");
});
els.dropZone.addEventListener("dragleave", () => {
  els.dropZone.classList.remove("dragging");
  els.floatingWidget.classList.remove("drag-mouth");
});
els.dropZone.addEventListener("drop", (event) => {
  els.dropZone.classList.remove("dragging");
  els.floatingWidget.classList.remove("drag-mouth");
  const dropped = Array.from(event.dataTransfer.files || []);
  if (dropped.length) {
    dropped.forEach((file) => state.files.push({ name: file.name, type: "拖入文件" }));
  } else {
    addMockFile("drop");
  }
  renderFiles();
  promptScreenshotIfEnabled();
  openQuickPanel();
  showToast("success", "已接收拖入文件。");
});

els.floatingWidget.addEventListener("click", (event) => {
  if (event.target.tagName.toLowerCase() === "button") return;
  if (els.floatingWidget.classList.contains("mini")) {
    els.floatingWidget.classList.remove("mini");
    els.toggleFloatButton.textContent = "收起";
    return;
  }
  openQuickPanel();
  showToast("neutral", "已打开快速归档小面板。");
});

els.floatingWidget.addEventListener("dragover", () => {
  els.floatingWidget.classList.add("dragging", "drag-mouth");
});
els.floatingWidget.addEventListener("dragleave", () => els.floatingWidget.classList.remove("dragging", "drag-mouth"));
els.floatingWidget.addEventListener("drop", (event) => {
  els.floatingWidget.classList.remove("dragging", "drag-mouth");
  const dropped = Array.from(event.dataTransfer.files || []);
  if (dropped.length) {
    dropped.forEach((file) => state.files.push({ name: file.name, type: "拖入文件" }));
  } else {
    addMockFile("drop");
  }
  renderFiles();
  promptScreenshotIfEnabled();
  openQuickPanel();
  showToast("success", "悬浮窗已接收文件。");
});

document.querySelector("#simulateDropButton").addEventListener("click", () => {
  addMockFile("drop");
  promptScreenshotIfEnabled();
  openQuickPanel();
  showToast("success", "已模拟拖入文件。");
});

document.querySelector("#previewDropButton").addEventListener("click", () => {
  addMockFile("drop");
  promptScreenshotIfEnabled();
  openQuickPanel();
  showToast("success", "已模拟拖入模型。");
});

els.toggleFloatButton.addEventListener("click", (event) => {
  event.stopPropagation();
  const mini = els.floatingWidget.classList.toggle("mini");
  els.toggleFloatButton.textContent = mini ? "展开" : "收起";
});

document.querySelector("#archiveButton").addEventListener("click", archiveFiles);
document.querySelector("#resetArchiveButton").addEventListener("click", resetArchive);
document.querySelector("#openQuickPanelButton").addEventListener("click", openQuickPanel);
document.querySelector("#closeQuickPanelButton").addEventListener("click", closeQuickPanel);
document.querySelector("#openSettingsButton").addEventListener("click", () => {
  closeQuickPanel();
  showView("settings");
});

document.querySelector("#checkShareButton").addEventListener("click", () => {
  setMessage(els.settingsMessage, "success", "模拟校验通过。正式应用需要检查共享盘存在且可写。");
});

document.querySelector("#saveSettingsButton").addEventListener("click", () => {
  if (!els.operatorName.value.trim() || !els.shareRoot.value.trim()) {
    setMessage(els.settingsMessage, "error", "姓名 / 昵称和共享盘根目录为必填项。");
    return;
  }
  state.configured = true;
  state.screenshotEnabled = els.screenshotEnabled.checked;
  state.mascotThreshold = Math.max(1, Number.parseInt(els.mascotThreshold.value, 10) || 1);
  renderScreenshotStep();
  updateMascot();
  els.configStatus.textContent = "配置已完成";
  setMessage(els.settingsMessage, "success", "设置已保存到当前 Demo 状态。");
});

els.mascotThreshold.addEventListener("change", () => {
  state.mascotThreshold = Math.max(1, Number.parseInt(els.mascotThreshold.value, 10) || 1);
  els.mascotThreshold.value = String(state.mascotThreshold);
  updateMascot();
});

els.screenshotEnabled.addEventListener("change", () => {
  state.screenshotEnabled = els.screenshotEnabled.checked;
  renderScreenshotStep();
  setMessage(
    els.settingsMessage,
    "neutral",
    state.screenshotEnabled ? "已开启拖入后截图提示。" : "已关闭拖入后截图提示。",
  );
});

els.captureScreenshotButton.addEventListener("click", () => {
  if (!state.screenshotEnabled) return;
  const exists = state.files.some((file) => file.name === "聊天截图.png");
  if (!exists) {
    state.files.push({ name: "聊天截图.png", type: "聊天截图" });
  }
  state.screenshotCaptured = true;
  renderFiles();
  renderScreenshotStep();
  showToast("success", "已模拟框选聊天截图。");
});

document.querySelector("#seedRecordButton").addEventListener("click", () => {
  state.records.unshift({
    id: crypto.randomUUID(),
    time: "09:20",
    discipline: "建筑",
    project: "A项目",
    source: "微信群1",
    note: "用户反馈打开后显示不完整，已交给测试。",
    folderName: "2026-05-27_0920_张三_A项目",
    targetPath: `${els.shareRoot.value}\\建筑\\2026-05-27_0920_张三_A项目`,
    fileCount: 2,
    ok: true,
  });
  renderRecords();
});

document.querySelector("#saveKnowledgeButton").addEventListener("click", () => {
  const keyword = els.knowledgeKeyword.value.trim();
  const scene = els.knowledgeScene.value.trim();
  const content = els.knowledgeContent.value.trim();
  if (!keyword || !content) {
    setMessage(els.knowledgeMessage, "error", "关键词和回复经验不能为空。");
    return;
  }
  state.knowledge.unshift({ keyword, scene, content });
  renderKnowledge();
  setMessage(els.knowledgeMessage, "success", "经验已保存为草稿。");
});

document.querySelector("#clearKnowledgeButton").addEventListener("click", () => {
  els.knowledgeKeyword.value = "";
  els.knowledgeScene.value = "";
  els.knowledgeContent.value = "";
  setMessage(els.knowledgeMessage, "neutral", "已清空经验记录表单。");
});

els.recordsTable.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-note]");
  if (!button) return;
  openNoteEditor(button.dataset.editNote);
});

document.querySelector("#closeNoteButton").addEventListener("click", closeNoteEditor);
document.querySelector("#saveRecordNoteButton").addEventListener("click", saveRecordNote);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeNoteEditor();
    closeQuickPanel();
  }
});

renderFiles();
renderRecords();
renderKnowledge();
updateFloatingCount();
renderScreenshotStep();
