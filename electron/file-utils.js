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

module.exports = {
  inferRoleFromPath,
  toAttachment,
  uniqueByPath
};
