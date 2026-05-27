const fs = require("node:fs/promises");
const path = require("node:path");
const Tesseract = require("tesseract.js");

function buildKnowledgePrompt({ payload, extractedTexts, usedOcr }) {
  return [
    "你是一个售后知识整理助手。",
    "请根据用户输入的问题、已有解决方案、聊天截图文本，整理成清晰的知识条目。",
    "输出严格 JSON，不要输出 Markdown，不要输出额外解释。",
    "JSON 结构为:",
    '{"items":[{"question":"...","answer":"...","notes":"..."}],"summary":"..."}',
    "要求：",
    "1. items 按问题拆分，每条都尽量独立可复用。",
    "2. answer 用可直接发给客户或同事的语气。",
    "3. notes 用于补充限制条件、版本信息或注意事项。",
    "4. 信息不足时，明确写“信息不足”。",
    "",
    `原始问题/聊天摘要: ${payload.rawIssue || "未填写"}`,
    `已有解决方案: ${payload.solutionNotes || "未填写"}`,
    `补充备注: ${payload.extraContext || "未填写"}`,
    `是否通过 OCR 提取截图文本: ${usedOcr ? "是" : "否"}`,
    `截图/图片提取文本:\n${extractedTexts || "无"}`
  ].join("\n");
}

async function extractTextFromImages(attachments) {
  const imageFiles = attachments.filter((item) => item.role === "image");
  if (!imageFiles.length) {
    return "";
  }

  const parts = [];
  for (const item of imageFiles) {
    const result = await Tesseract.recognize(item.path, "chi_sim+eng", {});
    const text = (result?.data?.text || "").trim();
    parts.push(`图片 ${item.name}:\n${text || "未识别到有效文字"}`);
  }

  return parts.join("\n\n");
}

async function fileToDataUrl(filePath) {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : ext === ".gif"
          ? "image/gif"
          : "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function generateKnowledgeWithModel({ config, payload }) {
  const endpoint = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const imageAttachments = payload.attachments.filter((item) => item.role === "image");
  const usedOcr = config.supportsVision !== true;
  const extractedTexts = usedOcr ? await extractTextFromImages(payload.attachments) : "";
  const prompt = buildKnowledgePrompt({ payload, extractedTexts, usedOcr });

  let messages;
  if (config.supportsVision === true && imageAttachments.length) {
    const content = [{ type: "text", text: prompt }];
    for (const item of imageAttachments) {
      content.push({
        type: "image_url",
        image_url: {
          url: await fileToDataUrl(item.path)
        }
      });
    }
    messages = [
      { role: "system", content: "你是一个严谨的售后知识整理助手。" },
      { role: "user", content }
    ];
  } else {
    messages = [
      { role: "system", content: "你是一个严谨的售后知识整理助手。" },
      { role: "user", content: prompt }
    ];
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`知识整理调用失败: ${response.status} ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("知识整理未返回可用内容。");
  }

  const parsed = JSON.parse(content);
  return {
    items: Array.isArray(parsed.items) ? parsed.items : [],
    summary: parsed.summary || "",
    usedOcr
  };
}

function generateKnowledgeFallback(payload) {
  return {
    items: [
      {
        question: payload.rawIssue || "待整理问题",
        answer: payload.solutionNotes || "暂未填写解决方案",
        notes: payload.extraContext || "信息不足"
      }
    ],
    summary: "当前未调用模型，已按原始输入生成基础知识条目。",
    usedOcr: false
  };
}

async function organizeKnowledge({ config, payload }) {
  if (!config.apiKey || !config.baseUrl || !config.model) {
    return {
      mode: "fallback",
      ...generateKnowledgeFallback(payload)
    };
  }

  try {
    return {
      mode: "ai",
      ...(await generateKnowledgeWithModel({ config, payload }))
    };
  } catch (error) {
    return {
      mode: "fallback",
      warning: error.message,
      ...generateKnowledgeFallback(payload)
    };
  }
}

module.exports = {
  organizeKnowledge
};
