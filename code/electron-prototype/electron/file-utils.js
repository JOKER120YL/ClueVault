const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { IMAGE_EXTENSIONS, MODEL_EXTENSIONS } = require("./constants");

function uniqueByPath(items) {
  const map = new Map();
  for (const item of items) {
    map.set(item.path, item);
  }
  return Array.from(map.values());
}

function inferRoleFromPath(filePath) {
  const extension = path.extname(filePath).replace(/^\./, "").toLowerCase();
  if (IMAGE_EXTENSIONS.includes(extension)) {
    return "image";
  }

  if (MODEL_EXTENSIONS.includes(extension)) {
    return "model";
  }

  return "other";
}

function toAttachment(filePath) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    path: filePath,
    name: path.basename(filePath),
    role: inferRoleFromPath(filePath)
  };
}

async function dataUrlToAttachment(dataUrl, fileNamePrefix = "pasted-image") {
  const matches = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!matches) {
    throw new Error("无效的图片数据。");
  }

  const mime = matches[1];
  const base64 = matches[2];
  const extension = mime.split("/")[1]?.replace("jpeg", "jpg") || "png";
  const filePath = path.join(os.tmpdir(), `${fileNamePrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`);
  await fs.writeFile(filePath, Buffer.from(base64, "base64"));
  return toAttachment(filePath);
}

module.exports = {
  dataUrlToAttachment,
  inferRoleFromPath,
  toAttachment,
  uniqueByPath
};
