const { normalizeTitle } = require("./bug-service");

async function generateDraftWithModel({ config, payload }) {
  const endpoint = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const prompt = [
    "你是 EasyBIM 的客服问题整理助手。",
    "请根据用户提供的信息，输出严格 JSON，不要输出 Markdown，不要输出额外解释。",
    "JSON 结构为: {\"title\":\"...\",\"summary\":\"...\",\"analysis\":\"...\"}",
    "要求：",
    "1. title 控制在 18 个中文字符左右，简洁直接。",
    "2. summary 用 2-4 句，总结现象和影响。",
    "3. analysis 用 2-4 条重点，说明研发测试组需要关注的方向。",
    "4. 如果信息不足，明确写出“信息不足”，不要臆造复现步骤。",
    "",
    `提交人: ${payload.submitter || "未填写"}`,
    `项目名: ${payload.projectName || "未填写"}`,
    `问题描述: ${payload.description || "未填写"}`,
    `补充说明: ${payload.extraNotes || "未填写"}`,
    `附件列表: ${payload.attachments.map((item) => `${item.role}:${item.name}`).join(", ") || "无"}`
  ].join("\n");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "你是一个严谨的客服问题整理助手。" },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI 调用失败: ${response.status} ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI 未返回可用内容。");
  }

  const parsed = JSON.parse(content);

  return {
    titleDraft: parsed.title || "",
    summaryDraft: parsed.summary || "",
    analysisDraft: parsed.analysis || ""
  };
}

function generateDraftFallback(payload) {
  const attachmentSummary = payload.attachments.length
    ? `已附带 ${payload.attachments.length} 个附件，包含 ${Array.from(new Set(payload.attachments.map((item) => item.role))).join("、")}。`
    : "当前没有附件，建议补充模型或截图。";

  return {
    titleDraft: normalizeTitle(payload.description).slice(0, 18) || "待确认问题",
    summaryDraft: `用户反馈的问题为：${payload.description || "暂无描述"}。${attachmentSummary}`,
    analysisDraft: [
      "请测试组优先核对模型文件与截图中表现是否一致。",
      "请结合原始描述确认问题发生场景、版本与影响范围。",
      "如当前信息不足，建议回收更多复现条件。"
    ].join("\n")
  };
}

async function generateDraft({ config, payload }) {
  if (!config.apiKey || !config.baseUrl || !config.model) {
    return {
      mode: "fallback",
      ...generateDraftFallback(payload)
    };
  }

  try {
    return {
      mode: "ai",
      ...(await generateDraftWithModel({ config, payload }))
    };
  } catch (error) {
    return {
      mode: "fallback",
      warning: error.message,
      ...generateDraftFallback(payload)
    };
  }
}

module.exports = {
  generateDraft
};
