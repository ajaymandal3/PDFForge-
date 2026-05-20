const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { compressedDir, uniqueName } = require('./storage');

function deriveKey(password) {
  const seed = process.env.AES_MASTER_KEY || 'huffzip-ai-master-key';
  return crypto.scryptSync(password || seed, seed, 32);
}

async function encryptFile(inputPath, password, originalName) {
  const fileBuffer = await fs.readFile(inputPath);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(password);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const outputPath = path.join(compressedDir, uniqueName(`${path.parse(originalName).name}-protected`, '.aes'));
  await fs.writeFile(outputPath, Buffer.concat([Buffer.from('HZAE'), iv, authTag, encrypted]));

  return { outputPath, bytes: encrypted.length };
}

async function decryptFile(inputPath, password, originalName) {
  const packed = await fs.readFile(inputPath);
  if (packed.length < 32 || packed.toString('utf8', 0, 4) !== 'HZAE') {
    throw new Error('Invalid encrypted file format');
  }

  const iv = packed.subarray(4, 16);
  const authTag = packed.subarray(16, 32);
  const encrypted = packed.subarray(32);
  const key = deriveKey(password);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  const outputPath = path.join(compressedDir, uniqueName(`${path.parse(originalName).name}-decrypted`, path.extname(originalName) || '.bin'));
  await fs.writeFile(outputPath, decrypted);
  return { outputPath, bytes: decrypted.length };
}

module.exports = { encryptFile, decryptFile };
