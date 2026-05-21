const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const pdfParse = require('pdf-parse');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { uniqueName, compressedDir } = require('./storage');
const { encryptFile } = require('./encryption');
const { LinkedList, Stack } = require('./dsStructures');

const execFileAsync = promisify(execFile);

const GS_QUALITY_PRESETS = {
  screen: '/screen',
  ebook: '/ebook',
  printer: '/printer',
  prepress: '/prepress',
};

function parsePageSelection(pageSpec, totalPages) {
  if (!pageSpec) {
    const stack = new Stack();
    stack.push(0);
    return stack.toArray();
  }

  const pages = new Set();
  const stack = new Stack();
  String(pageSpec)
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .forEach((segment) => stack.push(segment));

  stack.toArray().forEach((segment) => {
      const [startPart, endPart] = segment.split('-').map((value) => Number(value.trim()));
      if (Number.isInteger(startPart) && !Number.isInteger(endPart)) {
        if (startPart >= 1 && startPart <= totalPages) {
          pages.add(startPart - 1);
        }
        return;
      }
      const start = Number.isInteger(startPart) ? startPart : 1;
      const end = Number.isInteger(endPart) ? endPart : start;
      for (let page = start; page <= end; page += 1) {
        if (page >= 1 && page <= totalPages) {
          pages.add(page - 1);
        }
      }
  });

  return Array.from(pages).sort((left, right) => left - right);
}

async function loadDocument(filePath) {
  const buffer = await fs.readFile(filePath);
  return PDFDocument.load(buffer);
}

async function loadDocumentFromBuffer(buffer) {
  return PDFDocument.load(buffer);
}

async function saveDocument(document, outputPath, saveOptions = {}) {
  const bytes = await document.save({
    useObjectStreams: true,
    ...saveOptions,
  });
  await fs.writeFile(outputPath, bytes);
  return bytes.length;
}

async function compressPdfWithGhostscript(filePath, outputPath, quality = 'ebook') {
  const preset = GS_QUALITY_PRESETS[quality] || GS_QUALITY_PRESETS.ebook;
  const args = [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    `-dPDFSETTINGS=${preset}`,
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    `-sOutputFile=${outputPath}`,
    filePath,
  ];

  const binaries = process.platform === 'win32' ? ['gswin64c', 'gswin32c', 'gs'] : ['gs'];

  for (const binary of binaries) {
    try {
      await execFileAsync(binary, args, { maxBuffer: 20 * 1024 * 1024 });
      const stats = await fs.stat(outputPath);
      if (stats.size > 0) {
        return { outputSize: stats.size, method: 'ghostscript' };
      }
    } catch (error) {
      continue;
    }
  }

  throw new Error(
    'PDF compression requires Ghostscript. Install from https://ghostscript.com/releases/gsdnld.html and ensure gswin64c is on your PATH.',
  );
}

async function compressPdfWithPdfLib(filePath, outputPath) {
  const source = await loadDocument(filePath);
  const fresh = await PDFDocument.create();
  const copied = await fresh.copyPages(source, source.getPageIndices());
  copied.forEach((page) => fresh.addPage(page));
  const outputSize = await saveDocument(fresh, outputPath);
  return { outputSize, method: 'pdf-lib' };
}

async function compressPdf(filePath, originalName, quality = 'ebook') {
  if (!/\.pdf$/i.test(originalName || filePath)) {
    throw new Error('Only PDF files are supported.');
  }

  const outputPath = path.join(compressedDir, uniqueName(`${path.parse(originalName).name}-compressed`, '.pdf'));
  const inputStats = await fs.stat(filePath);

  try {
    const result = await compressPdfWithGhostscript(filePath, outputPath, quality);
    return {
      outputPath,
      outputSize: result.outputSize,
      originalSize: inputStats.size,
      method: result.method,
    };
  } catch (ghostscriptError) {
    const fallback = await compressPdfWithPdfLib(filePath, outputPath);
    if (fallback.outputSize >= inputStats.size) {
      throw new Error(
        'Could not reduce PDF size. Install Ghostscript (https://ghostscript.com) for best results — the built-in fallback only works on some files.',
      );
    }
    return {
      outputPath,
      outputSize: fallback.outputSize,
      originalSize: inputStats.size,
      method: fallback.method,
      warning: 'Limited compression without Ghostscript. Install Ghostscript for stronger results.',
    };
  }
}

async function mergePdfs(filePaths, originalName) {
  const merged = await PDFDocument.create();
  const fileQueue = new LinkedList();

  for (const filePath of filePaths) {
    const buffer = await fs.readFile(filePath);
    fileQueue.push(buffer);
  }

  for (const buffer of fileQueue.toArray()) {
    const source = await loadDocumentFromBuffer(buffer);
    const copied = await merged.copyPages(source, source.getPageIndices());
    copied.forEach((page) => merged.addPage(page));
  }

  const outputPath = path.join(compressedDir, uniqueName(`${path.parse(originalName).name}-merged`, '.pdf'));
  const outputSize = await saveDocument(merged, outputPath);
  return { outputPath, outputSize };
}

async function splitPdf(filePath, pageSpec, originalName) {
  const source = await loadDocument(filePath);
  const selectedPages = parsePageSelection(pageSpec, source.getPageCount());
  const selectionStack = new Stack();
  selectedPages.forEach((pageIndex) => selectionStack.push(pageIndex));
  const split = await PDFDocument.create();
  const copied = await split.copyPages(source, selectionStack.toArray());
  copied.forEach((page) => split.addPage(page));

  const outputPath = path.join(compressedDir, uniqueName(`${path.parse(originalName).name}-split`, '.pdf'));
  const outputSize = await saveDocument(split, outputPath);
  return { outputPath, outputSize, selectedPages: selectedPages.length };
}

async function rearrangePdf(filePath, orderSpec, originalName) {
  const source = await loadDocument(filePath);
  const order = parsePageSelection(orderSpec, source.getPageCount());
  const orderStack = new Stack();
  order.forEach((pageIndex) => orderStack.push(pageIndex));
  const rearranged = await PDFDocument.create();
  const copied = await rearranged.copyPages(source, orderStack.toArray());
  copied.forEach((page) => rearranged.addPage(page));

  const outputPath = path.join(compressedDir, uniqueName(`${path.parse(originalName).name}-rearranged`, '.pdf'));
  const outputSize = await saveDocument(rearranged, outputPath);
  return { outputPath, outputSize, orderCount: order.length };
}

async function watermarkPdf(filePath, watermarkText, originalName) {
  const source = await loadDocument(filePath);
  const font = await source.embedFont(StandardFonts.HelveticaBold);

  source.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    page.drawText(watermarkText || 'PDFForge', {
      x: width * 0.18,
      y: height * 0.5,
      size: 36,
      font,
      rotate: { type: 'degrees', angle: 35 },
      color: rgb(0.15, 0.55, 0.75),
      opacity: 0.2,
    });
  });

  const outputPath = path.join(compressedDir, uniqueName(`${path.parse(originalName).name}-watermarked`, '.pdf'));
  const outputSize = await saveDocument(source, outputPath);
  return { outputPath, outputSize };
}

async function extractPdfText(filePath) {
  const buffer = await fs.readFile(filePath);
  const parsed = await pdfParse(buffer);
  return parsed.text || '';
}

async function protectPdf(filePath, password, originalName) {
  const outputName = `${path.parse(originalName).name}-protected.pdf`;
  const protectedResult = await encryptFile(filePath, password, outputName);
  return {
    outputPath: protectedResult.outputPath,
    outputSize: protectedResult.bytes,
  };
}

module.exports = {
  mergePdfs,
  splitPdf,
  rearrangePdf,
  watermarkPdf,
  extractPdfText,
  protectPdf,
  compressPdf,
};
