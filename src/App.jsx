import { useEffect, useMemo, useState } from "react";

function uniqueByPath(items) {
  const map = new Map();
  for (const item of items) {
    map.set(item.path, item);
  }
  return Array.from(map.values());
}

const initialBugForm = {
  discipline: "architecture",
  projectName: "",
  submitter: "",
  description: "",
  attachments: []
};

const initialKnowledgeForm = {
  rawIssue: "",
  solutionNotes: "",
  extraContext: "",
  attachments: []
};

function App() {
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("bug");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bugDropActive, setBugDropActive] = useState(false);
  const [knowledgeDropActive, setKnowledgeDropActive] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingStorage, setTestingStorage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [organizingKnowledge, setOrganizingKnowledge] = useState(false);
  const [configStatus, setConfigStatus] = useState("");
  const [bugStatus, setBugStatus] = useState(null);
  const [knowledgeStatus, setKnowledgeStatus] = useState(null);
  const [knowledgeResult, setKnowledgeResult] = useState(null);
  const [knowledgeLibrary, setKnowledgeLibrary] = useState({ entries: [], meta: {} });
  const [knowledgeSyncing, setKnowledgeSyncing] = useState(false);
  const [widgetState, setWidgetState] = useState({
    todayCount: 0,
    threshold: 1,
    currentAvatar: "frog",
    enabled: true
  });
  const [bootstrap, setBootstrap] = useState({
    providerPresets: [],
    disciplineOptions: [],
    defaults: {},
    pendingAttachments: []
  });
  const [config, setConfig] = useState({
    displayName: "",
    storagePath: "",
    provider: "deepseek",
    baseUrl: "",
    model: "",
    apiKey: "",
    supportsVision: false,
    beeSwitchThreshold: 1,
    floatingWidgetEnabled: true
  });
  const [bugForm, setBugForm] = useState(initialBugForm);
  const [knowledgeForm, setKnowledgeForm] = useState(initialKnowledgeForm);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const result = await window.bugHelperApi.getBootstrap();
      if (!mounted) {
        return;
      }

      setBootstrap(result);
      setConfig(result.config);
      setWidgetState(result.widgetState);
      setKnowledgeLibrary(await window.bugHelperApi.getKnowledgeLibrary());
      setBugForm((current) => ({
        ...current,
        discipline: result.disciplineOptions?.[0]?.id || current.discipline,
        submitter: result.config.displayName || "",
        attachments: uniqueByPath([...current.attachments, ...(result.pendingAttachments || [])])
      }));
      setLoading(false);
      setSettingsOpen(!result.config.displayName?.trim());
    }

    load().catch((error) => {
      setConfigStatus(error.message || "初始化失败");
      setLoading(false);
    });

    const unsubscribeDrop = window.bugHelperApi.onWidgetFilesDropped((payload) => {
      setBugForm((current) => ({
        ...current,
        attachments: uniqueByPath([...current.attachments, ...(payload.attachments || [])])
      }));
      setBugStatus({
        kind: "success",
        text: `悬浮窗已收到 ${(payload.attachments || []).length} 个文件。`
      });
      setActiveView("bug");
    });

    const unsubscribeWidget = window.bugHelperApi.onWidgetStateUpdated((state) => {
      setWidgetState(state);
    });

    return () => {
      mounted = false;
      unsubscribeDrop?.();
      unsubscribeWidget?.();
    };
  }, []);

  const needsOnboarding = !config.displayName?.trim();
  const providerOptions = useMemo(() => bootstrap.providerPresets || [], [bootstrap.providerPresets]);
  const disciplineOptions = useMemo(() => bootstrap.disciplineOptions || [], [bootstrap.disciplineOptions]);

  function updateConfigField(key, value) {
    setConfig((current) => ({ ...current, [key]: value }));
    if (key === "displayName") {
      setBugForm((current) => ({ ...current, submitter: value }));
    }
  }

  function updateBugField(key, value) {
    setBugForm((current) => ({ ...current, [key]: value }));
  }

  function updateKnowledgeField(key, value) {
    setKnowledgeForm((current) => ({ ...current, [key]: value }));
  }

  function onProviderChange(providerId) {
    const selected = providerOptions.find((item) => item.id === providerId);
    setConfig((current) => ({
      ...current,
      provider: providerId,
      baseUrl: selected?.defaultBaseUrl || current.baseUrl
    }));
  }

  async function handleSaveConfig() {
    setSavingConfig(true);
    setConfigStatus("");
    try {
      const saved = await window.bugHelperApi.saveConfig(config);
      setConfig(saved);
      setBugForm((current) => ({
        ...current,
        submitter: current.submitter || saved.displayName
      }));
      setWidgetState(await window.bugHelperApi.getWidgetState());
      setConfigStatus("设置已保存。");
      if (saved.displayName?.trim()) {
        setSettingsOpen(false);
      }
    } catch (error) {
      setConfigStatus(error.message || "保存失败。");
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleTestStorage() {
    setTestingStorage(true);
    setConfigStatus("");
    try {
      await window.bugHelperApi.testStoragePath(config.storagePath);
      setConfigStatus("共享目录可访问且可写入。");
    } catch (error) {
      setConfigStatus(error.message || "共享目录校验失败。");
    } finally {
      setTestingStorage(false);
    }
  }

  async function handlePickAttachments(role, target) {
    try {
      const files = await window.bugHelperApi.pickAttachments(role);
      if (!files.length) {
        return;
      }

      if (target === "knowledge") {
        setKnowledgeForm((current) => ({
          ...current,
          attachments: uniqueByPath([...current.attachments, ...files])
        }));
      } else {
        setBugForm((current) => ({
          ...current,
          attachments: uniqueByPath([...current.attachments, ...files])
        }));
      }
    } catch (error) {
      const setter = target === "knowledge" ? setKnowledgeStatus : setBugStatus;
      setter({
        kind: "error",
        text: error.message || "选择附件失败。"
      });
    }
  }

  async function handleDropZone(event, target) {
    event.preventDefault();
    if (target === "knowledge") {
      setKnowledgeDropActive(false);
    } else {
      setBugDropActive(false);
    }
    const paths = Array.from(event.dataTransfer.files || []).map((file) => file.path).filter(Boolean);
    if (!paths.length) {
      return;
    }

    try {
      const files = await window.bugHelperApi.attachmentsFromPaths(paths);
      if (target === "knowledge") {
        setKnowledgeForm((current) => ({
          ...current,
          attachments: uniqueByPath([...current.attachments, ...files])
        }));
        setKnowledgeStatus({ kind: "success", text: `已加入 ${files.length} 个知识整理附件。` });
      } else {
        setBugForm((current) => ({
          ...current,
          attachments: uniqueByPath([...current.attachments, ...files])
        }));
        setBugStatus({ kind: "success", text: `已加入 ${files.length} 个提交附件。` });
      }
    } catch (error) {
      const setter = target === "knowledge" ? setKnowledgeStatus : setBugStatus;
      setter({
        kind: "error",
        text: error.message || "拖入文件失败。"
      });
    }
  }

  function removeAttachment(id, target) {
    if (target === "knowledge") {
      setKnowledgeForm((current) => ({
        ...current,
        attachments: current.attachments.filter((item) => item.id !== id)
      }));
    } else {
      setBugForm((current) => ({
        ...current,
        attachments: current.attachments.filter((item) => item.id !== id)
      }));
    }
  }

  async function handleSubmitBug() {
    setSubmitting(true);
    setBugStatus(null);
    try {
      const result = await window.bugHelperApi.submitBug({
        ...bugForm,
        titleDraft: bugForm.description,
        summaryDraft: "",
        analysisDraft: "",
        extraNotes: "",
        submitter: bugForm.submitter || config.displayName,
        createdAt: new Date().toISOString()
      });

      setWidgetState(result.widgetState);
      setBugStatus({
        kind: "success",
        text: `提交成功，已写入 ${result.targetDir}`
      });

      setBugForm((current) => ({
        ...initialBugForm,
        discipline: current.discipline,
        submitter: result.submitter
      }));
    } catch (error) {
      setBugStatus({
        kind: "error",
        text: error.message || "提交失败。"
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOrganizeKnowledge() {
    setOrganizingKnowledge(true);
    setKnowledgeStatus(null);
    try {
      const result = await window.bugHelperApi.organizeKnowledge(knowledgeForm);
      setKnowledgeResult(result);
      setKnowledgeStatus({
        kind: result.mode === "ai" ? "success" : "warning",
        text: result.mode === "ai" ? "知识整理已生成。" : `已生成基础整理结果。${result.warning ? ` ${result.warning}` : ""}`
      });
    } catch (error) {
      setKnowledgeStatus({
        kind: "error",
        text: error.message || "知识整理失败。"
      });
    } finally {
      setOrganizingKnowledge(false);
    }
  }

  async function refreshKnowledgeLibrary() {
    setKnowledgeLibrary(await window.bugHelperApi.getKnowledgeLibrary());
  }

  async function handleSaveKnowledgeResult() {
    if (!knowledgeResult?.items?.length) {
      setKnowledgeStatus({ kind: "warning", text: "当前没有可保存的知识条目。" });
      return;
    }

    setKnowledgeSyncing(true);
    try {
      const result = await window.bugHelperApi.saveKnowledgeItems({
        items: knowledgeResult.items,
        sourceLabel: "ai-organize"
      });
      await refreshKnowledgeLibrary();
      setKnowledgeStatus({
        kind: "success",
        text: `已保存到知识库，新增 ${result.added} 条，更新 ${result.updated} 条。`
      });
    } catch (error) {
      setKnowledgeStatus({
        kind: "error",
        text: error.message || "保存知识库失败。"
      });
    } finally {
      setKnowledgeSyncing(false);
    }
  }

  async function handleExportKnowledge(mode) {
    setKnowledgeSyncing(true);
    try {
      const result = await window.bugHelperApi.exportKnowledge(mode);
      if (result.canceled) {
        setKnowledgeStatus({ kind: "warning", text: "已取消导出。" });
      } else {
        await refreshKnowledgeLibrary();
        setKnowledgeStatus({
          kind: "success",
          text: `${mode === "incremental" ? "增量" : "完整"}导出成功，共 ${result.count} 条。`
        });
      }
    } catch (error) {
      setKnowledgeStatus({
        kind: "error",
        text: error.message || "导出失败。"
      });
    } finally {
      setKnowledgeSyncing(false);
    }
  }

  async function handleImportKnowledge() {
    setKnowledgeSyncing(true);
    try {
      const result = await window.bugHelperApi.importKnowledge();
      if (result.canceled) {
        setKnowledgeStatus({ kind: "warning", text: "已取消导入。" });
      } else {
        await refreshKnowledgeLibrary();
        setKnowledgeStatus({
          kind: "success",
          text: `导入完成，新增 ${result.added} 条，更新 ${result.updated} 条，自动去重后总计 ${result.total} 条。`
        });
      }
    } catch (error) {
      setKnowledgeStatus({
        kind: "error",
        text: error.message || "导入失败。"
      });
    } finally {
      setKnowledgeSyncing(false);
    }
  }

  if (loading) {
    return <div className="loading-screen">正在加载 ClueVault...</div>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ClueVault</p>
          <h1>问题提交与知识整理</h1>
        </div>
        <div className="topbar-actions">
          <div className={`avatar-pill ${widgetState.currentAvatar}`}>
            <span>{widgetState.currentAvatar === "bee" ? "蜂哥" : "蛙弟"}</span>
            <strong>
              {widgetState.todayCount}/{widgetState.threshold}
            </strong>
          </div>
          <button className={activeView === "bug" ? "" : "ghost"} onClick={() => setActiveView("bug")}>
            快速提 Bug
          </button>
          <button className={activeView === "knowledge" ? "" : "ghost"} onClick={() => setActiveView("knowledge")}>
            知识整理
          </button>
          <button className="ghost" onClick={() => setSettingsOpen(true)}>
            设置
          </button>
        </div>
      </header>

      {activeView === "bug" ? (
        <main className="single-layout">
          <section className="quick-card quick-card-main">
            <div className="quick-head">
              <div>
                <h2>提 bug 只保留最少输入</h2>
                <p>选专业、拖文件、写一句“有什么问题”，然后直接提交。</p>
              </div>
              {needsOnboarding ? <span className="badge warning">先完成设置</span> : null}
            </div>

            <div
              className={`dropzone ${bugDropActive ? "active" : ""}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setBugDropActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setBugDropActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setBugDropActive(false);
              }}
              onDrop={(event) => handleDropZone(event, "bug")}
            >
              <strong>把模型、图片、`.eb` 文件直接拖到这里</strong>
              <p>悬浮窗拖入的文件也会自动进入当前提 bug 列表。</p>
              <div className="button-row">
                <button className="ghost" onClick={() => handlePickAttachments("model", "bug")}>
                  添加模型 / `.eb`
                </button>
                <button className="ghost" onClick={() => handlePickAttachments("image", "bug")}>
                  添加图片
                </button>
                <button className="ghost" onClick={() => handlePickAttachments("other", "bug")}>
                  其他附件
                </button>
              </div>
            </div>

            <div className="compact-row">
              <label>
                所属专业 <span className="required-mark">*</span>
                <select value={bugForm.discipline} onChange={(event) => updateBugField("discipline", event.target.value)}>
                  {disciplineOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                提交人
                <input
                  value={bugForm.submitter}
                  onChange={(event) => updateBugField("submitter", event.target.value)}
                  placeholder="默认使用本地配置"
                />
              </label>
            </div>

            <label>
              问题描述 <span className="required-mark">*</span>
              <textarea
                value={bugForm.description}
                onChange={(event) => updateBugField("description", event.target.value)}
                placeholder="例如：导出后楼梯丢失、结构梁错位、平台问题所有专业都出现。"
                rows={5}
              />
            </label>

            <div className="compact-row">
              <label>
                目标专业目录
                <input
                  readOnly
                  value={`${config.storagePath || bootstrap.defaults.storagePath || ""}\\${
                    disciplineOptions.find((item) => item.id === bugForm.discipline)?.folderName || ""
                  }`}
                />
              </label>
              <label>
                项目名
                <input
                  value={bugForm.projectName}
                  onChange={(event) => updateBugField("projectName", event.target.value)}
                  placeholder="选填"
                />
              </label>
            </div>

            <div className="attachment-list">
              {bugForm.attachments.length ? (
                bugForm.attachments.map((item) => (
                  <div className="attachment-chip" key={item.id}>
                    <span>{item.role}</span>
                    <strong>{item.name}</strong>
                    <button className="text-button" onClick={() => removeAttachment(item.id, "bug")}>
                      移除
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty-inline">还没有附件，直接拖文件进来会更快。</div>
              )}
            </div>

            <div className="submit-panel">
              <button className="primary-large" onClick={handleSubmitBug} disabled={submitting}>
                {submitting ? "提交中..." : "直接提交"}
              </button>
              {bugStatus ? <div className={`status-card ${bugStatus.kind}`}>{bugStatus.text}</div> : null}
            </div>
          </section>
        </main>
      ) : (
        <main className="knowledge-layout">
          <section className="quick-card quick-card-main">
            <div className="quick-head">
              <div>
                <h2>整理每天遇到的问题和解法</h2>
                <p>这里才使用 AI。你可以放聊天截图、原始问题和已有解决方案，让模型归纳成一条条答复方案。</p>
              </div>
              <button onClick={handleOrganizeKnowledge} disabled={organizingKnowledge}>
                {organizingKnowledge ? "整理中..." : "开始整理"}
              </button>
            </div>

            <div
              className={`dropzone ${knowledgeDropActive ? "active" : ""}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setKnowledgeDropActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setKnowledgeDropActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setKnowledgeDropActive(false);
              }}
              onDrop={(event) => handleDropZone(event, "knowledge")}
            >
              <strong>把聊天截图、相关图片拖到这里</strong>
              <p>
                当前模型{config.supportsVision ? "支持直接看图，会优先直接传图片。" : "不支持直接看图，会先 OCR 提取图片文字后再整理。"}
              </p>
              <div className="button-row">
                <button className="ghost" onClick={() => handlePickAttachments("image", "knowledge")}>
                  添加聊天截图
                </button>
                <button className="ghost" onClick={() => handlePickAttachments("other", "knowledge")}>
                  其他材料
                </button>
              </div>
            </div>

            <label>
              原始问题 / 聊天摘要
              <textarea
                value={knowledgeForm.rawIssue}
                onChange={(event) => updateKnowledgeField("rawIssue", event.target.value)}
                placeholder="把你当天遇到的问题、客户怎么问的，简单贴进来。"
                rows={5}
              />
            </label>

            <label>
              已有解决方案
              <textarea
                value={knowledgeForm.solutionNotes}
                onChange={(event) => updateKnowledgeField("solutionNotes", event.target.value)}
                placeholder="把你已经确认过的解法、话术、操作步骤放这里。"
                rows={5}
              />
            </label>

            <label>
              补充备注
              <textarea
                value={knowledgeForm.extraContext}
                onChange={(event) => updateKnowledgeField("extraContext", event.target.value)}
                placeholder="版本限制、适用条件、额外注意事项等。"
                rows={3}
              />
            </label>

            <div className="attachment-list">
              {knowledgeForm.attachments.length ? (
                knowledgeForm.attachments.map((item) => (
                  <div className="attachment-chip" key={item.id}>
                    <span>{item.role}</span>
                    <strong>{item.name}</strong>
                    <button className="text-button" onClick={() => removeAttachment(item.id, "knowledge")}>
                      移除
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty-inline">还没有知识整理附件，建议放聊天截图。</div>
              )}
            </div>

            <div className="button-row">
              <button className="ghost" onClick={handleSaveKnowledgeResult} disabled={knowledgeSyncing}>
                保存到知识库
              </button>
              <button className="ghost" onClick={() => handleExportKnowledge("full")} disabled={knowledgeSyncing}>
                导出全部
              </button>
              <button className="ghost" onClick={() => handleExportKnowledge("incremental")} disabled={knowledgeSyncing}>
                导出新增
              </button>
              <button className="ghost" onClick={handleImportKnowledge} disabled={knowledgeSyncing}>
                导入并去重
              </button>
            </div>
          </section>

          <section className="quick-card quick-card-side">
            <div className="quick-head">
              <div>
                <h2>整理结果</h2>
                <p>{knowledgeResult?.usedOcr ? "本次已先 OCR 再整理。" : "本次未使用 OCR。"} </p>
              </div>
            </div>

            {knowledgeStatus ? <div className={`status-card ${knowledgeStatus.kind}`}>{knowledgeStatus.text}</div> : null}

            {knowledgeResult ? (
              <div className="knowledge-result">
                <div className="knowledge-summary">{knowledgeResult.summary || "暂无摘要"}</div>
                {knowledgeResult.items.map((item, index) => (
                  <div className="knowledge-item" key={`${item.question}-${index}`}>
                    <strong>{item.question || "未命名问题"}</strong>
                    <p>{item.answer || "暂无解答"}</p>
                    <small>{item.notes || "无补充备注"}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-inline">整理后会在这里生成一条条问题对应的解答方案。</div>
            )}

            <div className="knowledge-library">
              <div className="quick-head">
                <div>
                  <h2>知识库</h2>
                  <p>支持去重、增量导入和增量备份。</p>
                </div>
              </div>
              <div className="helper-card">
                当前共 {knowledgeLibrary.entries?.length || 0} 条
                {knowledgeLibrary.meta?.lastExportAt ? `，上次增量导出：${knowledgeLibrary.meta.lastExportAt}` : "，还没有做过增量导出"}
              </div>
              <div className="knowledge-library-list">
                {(knowledgeLibrary.entries || []).slice(0, 8).map((item) => (
                  <div className="knowledge-item compact" key={item.id}>
                    <strong>{item.question || "未命名问题"}</strong>
                    <small>{item.answer || "暂无答案"}</small>
                  </div>
                ))}
                {!knowledgeLibrary.entries?.length ? (
                  <div className="empty-inline">知识库还是空的，先整理一批结果再保存进来。</div>
                ) : null}
              </div>
            </div>
          </section>
        </main>
      )}

      {settingsOpen ? (
        <div className="settings-backdrop" onClick={() => !needsOnboarding && setSettingsOpen(false)}>
          <section className="settings-panel" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <div>
                <p className="eyebrow">设置</p>
                <h2>个人、共享目录与模型配置</h2>
              </div>
              {!needsOnboarding ? (
                <button className="ghost" onClick={() => setSettingsOpen(false)}>
                  关闭
                </button>
              ) : null}
            </div>

            <label>
              姓名 / 昵称 <span className="required-mark">*</span>
              <input
                value={config.displayName}
                onChange={(event) => updateConfigField("displayName", event.target.value)}
                placeholder="例如：小陈"
              />
            </label>

            <label>
              共享目录 <span className="required-mark">*</span>
              <input
                value={config.storagePath}
                onChange={(event) => updateConfigField("storagePath", event.target.value)}
                placeholder={bootstrap.defaults.storagePath}
              />
            </label>

            <label>
              大模型供应商
              <select value={config.provider} onChange={(event) => onProviderChange(event.target.value)}>
                {providerOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="compact-row">
              <label>
                Base URL
                <input
                  value={config.baseUrl}
                  onChange={(event) => updateConfigField("baseUrl", event.target.value)}
                  placeholder="https://api.deepseek.com/v1"
                />
              </label>
              <label>
                模型名
                <input
                  value={config.model}
                  onChange={(event) => updateConfigField("model", event.target.value)}
                  placeholder="deepseek-chat"
                />
              </label>
            </div>

            <label>
              API Key
              <input
                type="password"
                value={config.apiKey}
                onChange={(event) => updateConfigField("apiKey", event.target.value)}
                placeholder="sk-..."
              />
            </label>

            <div className="compact-row">
              <label className="toggle-row">
                <span>模型支持图片识别</span>
                <input
                  type="checkbox"
                  checked={config.supportsVision === true}
                  onChange={(event) => updateConfigField("supportsVision", event.target.checked)}
                />
              </label>
              <label className="toggle-row">
                <span>启用悬浮窗</span>
                <input
                  type="checkbox"
                  checked={config.floatingWidgetEnabled !== false}
                  onChange={(event) => updateConfigField("floatingWidgetEnabled", event.target.checked)}
                />
              </label>
            </div>

            <div className="compact-row">
              <label>
                蜂哥切换阈值
                <input
                  type="number"
                  min="1"
                  value={config.beeSwitchThreshold}
                  onChange={(event) => updateConfigField("beeSwitchThreshold", event.target.value)}
                />
              </label>
              <div className="helper-card">
                {config.supportsVision
                  ? "当前会优先直接把聊天截图传给模型。"
                  : "当前会先 OCR 提取截图文字，再交给模型整理。"}
              </div>
            </div>

            <div className="button-row">
              <button className="ghost" onClick={handleTestStorage} disabled={testingStorage}>
                {testingStorage ? "校验中..." : "校验共享目录"}
              </button>
              <button onClick={handleSaveConfig} disabled={savingConfig}>
                {savingConfig ? "保存中..." : "保存设置"}
              </button>
            </div>

            {configStatus ? <p className="status-line">{configStatus}</p> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default App;
