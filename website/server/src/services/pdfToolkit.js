const fs = require('fs/promises');
const path = require('path');
const pdfParse = require('pdf-parse');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { uniqueName, compressedDir } = require('./storage');
const { encryptFile } = require('./encryption');

function parsePageSelection(pageSpec, totalPages) {
  if (!pageSpec) {
    return [0];
  }

  const pages = new Set();
  String(pageSpec)
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .forEach((segment) => {
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

async function saveDocument(document, outputPath) {
  const bytes = await document.save();
  await fs.writeFile(outputPath, bytes);
  return bytes.length;
}

async function mergePdfs(filePaths, originalName) {
  const merged = await PDFDocument.create();

  for (const filePath of filePaths) {
    const source = await loadDocument(filePath);
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
  const split = await PDFDocument.create();
  const copied = await split.copyPages(source, selectedPages);
  copied.forEach((page) => split.addPage(page));

  const outputPath = path.join(compressedDir, uniqueName(`${path.parse(originalName).name}-split`, '.pdf'));
  const outputSize = await saveDocument(split, outputPath);
  return { outputPath, outputSize, selectedPages: selectedPages.length };
}

async function rearrangePdf(filePath, orderSpec, originalName) {
  const source = await loadDocument(filePath);
  const order = parsePageSelection(orderSpec, source.getPageCount());
  const rearranged = await PDFDocument.create();
  const copied = await rearranged.copyPages(source, order);
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
    page.drawText(watermarkText || 'HuffZip AI', {
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
};
