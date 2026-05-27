import { useEffect, useMemo, useState } from "react";

const emptyDraft = {
  titleDraft: "",
  summaryDraft: "",
  analysisDraft: ""
};

function uniqueByPath(items) {
  const map = new Map();
  for (const item of items) {
    map.set(item.path, item);
  }
  return Array.from(map.values());
}

function App() {
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingStorage, setTestingStorage] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [configStatus, setConfigStatus] = useState("");
  const [submitStatus, setSubmitStatus] = useState(null);
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
    beeSwitchThreshold: 1,
    floatingWidgetEnabled: true
  });
  const [form, setForm] = useState({
    discipline: "architecture",
    projectName: "",
    submitter: "",
    description: "",
    extraNotes: "",
    attachments: [],
    ...emptyDraft
  });

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
      setForm((current) => ({
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
      setForm((current) => ({
        ...current,
        attachments: uniqueByPath([...current.attachments, ...(payload.attachments || [])])
      }));
      setSubmitStatus({
        kind: "success",
        text: `悬浮窗已收到 ${(payload.attachments || []).length} 个文件。`
      });
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
      setForm((current) => ({ ...current, submitter: value }));
    }
  }

  function updateFormField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
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
      setForm((current) => ({
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

  async function handlePickAttachments(role) {
    try {
      const files = await window.bugHelperApi.pickAttachments(role);
      if (!files.length) {
        return;
      }

      setForm((current) => ({
        ...current,
        attachments: uniqueByPath([...current.attachments, ...files])
      }));
    } catch (error) {
      setSubmitStatus({
        kind: "error",
        text: error.message || "选择附件失败。"
      });
    }
  }

  async function handleDropZone(event) {
    event.preventDefault();
    setDropActive(false);
    const paths = Array.from(event.dataTransfer.files || []).map((file) => file.path).filter(Boolean);
    if (!paths.length) {
      return;
    }

    try {
      const files = await window.bugHelperApi.attachmentsFromPaths(paths);
      setForm((current) => ({
        ...current,
        attachments: uniqueByPath([...current.attachments, ...files])
      }));
      setSubmitStatus({
        kind: "success",
        text: `已加入 ${files.length} 个文件。`
      });
    } catch (error) {
      setSubmitStatus({
        kind: "error",
        text: error.message || "拖入文件失败。"
      });
    }
  }

  function removeAttachment(id) {
    setForm((current) => ({
      ...current,
      attachments: current.attachments.filter((item) => item.id !== id)
    }));
  }

  async function handleGenerateDraft() {
    setGeneratingDraft(true);
    setSubmitStatus(null);
    try {
      const result = await window.bugHelperApi.generateDraft({
        ...form,
        submitter: form.submitter || config.displayName,
        createdAt: new Date().toISOString()
      });

      setForm((current) => ({
        ...current,
        titleDraft: result.titleDraft,
        summaryDraft: result.summaryDraft,
        analysisDraft: result.analysisDraft
      }));

      setSubmitStatus({
        kind: result.mode === "ai" ? "success" : "warning",
        text: result.mode === "ai" ? "AI 草稿已生成。" : "AI 不可用，已生成本地草稿。"
      });
    } catch (error) {
      setSubmitStatus({
        kind: "error",
        text: error.message || "生成草稿失败。"
      });
    } finally {
      setGeneratingDraft(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitStatus(null);
    try {
      const result = await window.bugHelperApi.submitBug({
        ...form,
        submitter: form.submitter || config.displayName,
        createdAt: new Date().toISOString()
      });

      setWidgetState(result.widgetState);
      setSubmitStatus({
        kind: "success",
        text: `提交成功，已写入 ${result.targetDir}`
      });

      setForm((current) => ({
        ...current,
        discipline: current.discipline,
        projectName: "",
        description: "",
        extraNotes: "",
        attachments: [],
        titleDraft: "",
        summaryDraft: "",
        analysisDraft: "",
        submitter: result.submitter
      }));
    } catch (error) {
      setSubmitStatus({
        kind: "error",
        text: error.message || "提交失败。"
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="loading-screen">正在加载 EasyBIM Bug 收集助手...</div>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ClueVault</p>
          <h1>快速反馈</h1>
        </div>
        <div className="topbar-actions">
          <div className={`avatar-pill ${widgetState.currentAvatar}`}>
            <span>{widgetState.currentAvatar === "bee" ? "蜂哥" : "蛙弟"}</span>
            <strong>
              {widgetState.todayCount}/{widgetState.threshold}
            </strong>
          </div>
          <button className="ghost" onClick={() => setSettingsOpen(true)}>
            设置
          </button>
        </div>
      </header>

      <main className="quick-layout">
        <section className="quick-card quick-card-main">
          <div className="quick-head">
            <div>
              <h2>拖入文件，写一句问题描述，直接提交</h2>
              <p>常用流程放在一页内，设置项收进单独面板。</p>
            </div>
            {needsOnboarding ? <span className="badge warning">先完成设置</span> : null}
          </div>

          <div
            className={`dropzone ${dropActive ? "active" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDropActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDropActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDropActive(false);
            }}
            onDrop={handleDropZone}
          >
            <strong>把模型、图片、`.eb` 文件直接拖到这里</strong>
            <p>也可以用下面按钮选择文件。悬浮窗拖入的文件也会自动进来。</p>
            <div className="button-row">
              <button className="ghost" onClick={() => handlePickAttachments("model")}>
                添加模型 / `.eb`
              </button>
              <button className="ghost" onClick={() => handlePickAttachments("image")}>
                添加图片
              </button>
              <button className="ghost" onClick={() => handlePickAttachments("other")}>
                其他附件
              </button>
            </div>
          </div>

          <div className="compact-row">
            <label>
              所属专业 <span className="required-mark">*</span>
              <select value={form.discipline} onChange={(event) => updateFormField("discipline", event.target.value)}>
                {disciplineOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              项目名
              <input
                value={form.projectName}
                onChange={(event) => updateFormField("projectName", event.target.value)}
                placeholder="选填，例如 Revit 导出"
              />
            </label>
            <label>
              提交人
              <input
                value={form.submitter}
                onChange={(event) => updateFormField("submitter", event.target.value)}
                placeholder="默认使用本地配置"
              />
            </label>
            <label>
              目标专业目录
              <input
                readOnly
                value={`${config.storagePath || bootstrap.defaults.storagePath || ""}\\${
                  disciplineOptions.find((item) => item.id === form.discipline)?.folderName || ""
                }`}
                placeholder="按所选专业自动落目录"
              />
            </label>
          </div>

          <label>
            问题描述 <span className="required-mark">*</span>
            <textarea
              value={form.description}
              onChange={(event) => updateFormField("description", event.target.value)}
              placeholder="这里尽量只写现象和影响，不用一次写很全。"
              rows={5}
            />
          </label>

          <label>
            补充说明
            <textarea
              value={form.extraNotes}
              onChange={(event) => updateFormField("extraNotes", event.target.value)}
              placeholder="版本、客户背景、研发提醒等选填信息。"
              rows={3}
            />
          </label>

          <div className="attachment-list">
            {form.attachments.length ? (
              form.attachments.map((item) => (
                <div className="attachment-chip" key={item.id}>
                  <span>{item.role}</span>
                  <strong>{item.name}</strong>
                  <button className="text-button" onClick={() => removeAttachment(item.id)}>
                    移除
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-inline">还没有附件，直接拖文件进来会更快。</div>
            )}
          </div>
        </section>

        <section className="quick-card quick-card-side">
          <div className="quick-head">
            <div>
              <h2>AI 草稿</h2>
              <p>先出草稿，你再确认。</p>
            </div>
            <button onClick={handleGenerateDraft} disabled={generatingDraft}>
              {generatingDraft ? "生成中..." : "生成草稿"}
            </button>
          </div>

          <label>
            标题
            <input
              value={form.titleDraft}
              onChange={(event) => updateFormField("titleDraft", event.target.value)}
              placeholder="AI 或手动填写标题"
            />
          </label>
          <label>
            摘要
            <textarea
              value={form.summaryDraft}
              onChange={(event) => updateFormField("summaryDraft", event.target.value)}
              rows={4}
              placeholder="给研发测试组看的简短摘要"
            />
          </label>
          <label>
            分析结论
            <textarea
              value={form.analysisDraft}
              onChange={(event) => updateFormField("analysisDraft", event.target.value)}
              rows={6}
              placeholder="AI 分析重点，可手动改"
            />
          </label>

          <div className="submit-panel">
            <button className="primary-large" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "提交中..." : "确认提交"}
            </button>
            {submitStatus ? <div className={`status-card ${submitStatus.kind}`}>{submitStatus.text}</div> : null}
          </div>
        </section>
      </main>

      {settingsOpen ? (
        <div className="settings-backdrop" onClick={() => !needsOnboarding && setSettingsOpen(false)}>
          <section className="settings-panel" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <div>
                <p className="eyebrow">设置</p>
                <h2>个人、共享目录与 AI</h2>
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
              <label>
                蜂哥切换阈值
                <input
                  type="number"
                  min="1"
                  value={config.beeSwitchThreshold}
                  onChange={(event) => updateConfigField("beeSwitchThreshold", event.target.value)}
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
