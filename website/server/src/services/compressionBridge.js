const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');
const { compressedDir, uniqueName } = require('./storage');

const execFileAsync = promisify(execFile);

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
  const outputPath = path.join(compressedDir, uniqueName(`${path.parse(originalName).name}-compressed`, '.huff'));
  const result = await runEngine('compress', inputPath, outputPath);
  const stats = await fs.stat(outputPath);
  return {
    ...result,
    outputPath,
    outputSize: stats.size,
  };
}

async function decompressFile(inputPath, fallbackName) {
  const outputPath = path.join(compressedDir, uniqueName(`${path.parse(fallbackName).name}-restored`, '.bin'));
  const result = await runEngine('decompress', inputPath, outputPath);
  const stats = await fs.stat(outputPath);
  return {
    ...result,
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
