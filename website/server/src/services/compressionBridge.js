const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');
const zlib = require('zlib');
const { compressedDir, tempDir, uniqueName } = require('./storage');

const execFileAsync = promisify(execFile);
const ARCHIVE_MAGIC = Buffer.from('HZDF');

async function ensureOutputDirs() {
  await Promise.all([
    fs.mkdir(compressedDir, { recursive: true }),
    fs.mkdir(tempDir, { recursive: true }),
  ]);
}

async function safeUnlink(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // ignore cleanup failures
  }
}

async function resolveExistingPath(candidates) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch (error) {
      continue;
    }
  }

  return candidates[0];
}

async function getEngineBinaryPath() {
  if (process.env.CPP_ENGINE_PATH) {
    return path.resolve(process.env.CPP_ENGINE_PATH);
  }

  const executableName = process.platform === 'win32' ? 'huffzip-ai.exe' : 'huffzip-ai';
  const buildRoot = path.resolve(__dirname, '..', '..', '..', '..', 'engine', 'build');
  return resolveExistingPath([
    path.join(buildRoot, 'Debug', executableName),
    path.join(buildRoot, 'Release', executableName),
    path.join(buildRoot, executableName),
  ]);
}

async function runEngine(command, inputPath, outputPath) {
  const binaryPath = await getEngineBinaryPath();
  const result = await execFileAsync(binaryPath, [command, inputPath, outputPath], {
    maxBuffer: 10 * 1024 * 1024,
  });

  const payload = result.stdout ? JSON.parse(result.stdout) : {};
  return payload;
}

async function compressFile(inputPath, originalName) {
  await ensureOutputDirs();

  const rawArchivePath = path.join(tempDir, uniqueName(`${path.parse(originalName).name}-raw`, '.huff'));
  const outputPath = path.join(compressedDir, uniqueName(`${path.parse(originalName).name}-compressed`, '.huff'));

  try {
    const result = await runEngine('compress', inputPath, rawArchivePath);
    const rawArchive = await fs.readFile(rawArchivePath);
    const deflatedArchive = zlib.deflateSync(rawArchive, { level: 9 });
    await fs.writeFile(outputPath, Buffer.concat([ARCHIVE_MAGIC, deflatedArchive]));
    const stats = await fs.stat(outputPath);

    return {
      ...result,
      compressionStages: ['huffman', 'deflate'],
      outputPath,
      outputSize: stats.size,
    };
  } finally {
    await safeUnlink(rawArchivePath);
  }
}

async function decompressFile(inputPath, fallbackName) {
  await ensureOutputDirs();

  const outputPath = path.join(compressedDir, uniqueName(`${path.parse(fallbackName).name}-restored`, '.bin'));
  const inputBytes = await fs.readFile(inputPath);

  if (inputBytes.length > ARCHIVE_MAGIC.length && inputBytes.subarray(0, ARCHIVE_MAGIC.length).equals(ARCHIVE_MAGIC)) {
    const rawArchivePath = path.join(tempDir, uniqueName(`${path.parse(fallbackName).name}-raw`, '.huff'));

    try {
      const rawArchive = zlib.inflateSync(inputBytes.subarray(ARCHIVE_MAGIC.length));
      await fs.writeFile(rawArchivePath, rawArchive);
      const result = await runEngine('decompress', rawArchivePath, outputPath);
      const stats = await fs.stat(outputPath);
      return {
        ...result,
        wrapped: true,
        outputPath,
        outputSize: stats.size,
      };
    } finally {
      await safeUnlink(rawArchivePath);
    }
  }

  const result = await runEngine('decompress', inputPath, outputPath);
  const stats = await fs.stat(outputPath);
  return {
    ...result,
    wrapped: false,
    outputPath,
    outputSize: stats.size,
  };
}

async function analyzeCompression(inputPath, originalName) {
  const analysis = await runEngine('analyze', inputPath, inputPath);
  return {
    ...analysis,
    fileName: originalName,
  };
}

module.exports = {
  compressFile,
  decompressFile,
  analyzeCompression,
};
