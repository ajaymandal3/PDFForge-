const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const uploadsDir = path.join(projectRoot, 'uploads');
const compressedDir = path.join(projectRoot, 'compressed');
const tempDir = path.join(projectRoot, 'temp');

const downloadTokens = new Map();

function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function uniqueName(prefix, extension = '') {
  const safeExtension = extension && !extension.startsWith('.') ? `.${extension}` : extension;
  return `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExtension}`;
}

async function ensureDirectories() {
  await Promise.all([
    fs.mkdir(uploadsDir, { recursive: true }),
    fs.mkdir(compressedDir, { recursive: true }),
    fs.mkdir(tempDir, { recursive: true }),
  ]);
}

function scheduleCleanup(targetPaths, ttlMs) {
  const paths = Array.isArray(targetPaths) ? targetPaths : [targetPaths];
  const timer = setTimeout(async () => {
    await Promise.allSettled(paths.map((targetPath) => fs.unlink(targetPath)));
  }, ttlMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

function createDownloadToken(filePath, fileName, ttlMs) {
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + ttlMs;
  downloadTokens.set(token, { filePath, fileName, expiresAt });

  const timer = setTimeout(() => downloadTokens.delete(token), ttlMs);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  return token;
}

function consumeDownloadToken(token) {
  const entry = downloadTokens.get(token);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt < Date.now()) {
    downloadTokens.delete(token);
    return null;
  }

  return entry;
}

function removeDownloadToken(token) {
  downloadTokens.delete(token);
}

function cleanupTempArtifacts(...targets) {
  const ttlMs = Number(process.env.FILE_TTL_MINUTES || 10) * 60 * 1000;
  scheduleCleanup(targets.flat().filter(Boolean), ttlMs);
}

module.exports = {
  uploadsDir,
  compressedDir,
  tempDir,
  ensureDirectories,
  scheduleCleanup,
  createDownloadToken,
  consumeDownloadToken,
  removeDownloadToken,
  cleanupTempArtifacts,
  uniqueName,
  sanitizeName,
};
