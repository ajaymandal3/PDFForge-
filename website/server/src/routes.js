const express = require('express');
const multer = require('multer');
const fs = require('fs/promises');
const path = require('path');
const { uploadsDir, compressedDir, cleanupTempArtifacts, createDownloadToken, consumeDownloadToken, removeDownloadToken, sanitizeName, uniqueName } = require('./services/storage');
const { compressFile, decompressFile, analyzeCompression } = require('./services/compressionBridge');
const { mergePdfs, splitPdf, rearrangePdf, watermarkPdf, extractPdfText, protectPdf, compressPdf } = require('./services/pdfToolkit');
const { summarizePdf } = require('./services/geminiSummarizer');
const { analyzeResume, recommendCompression } = require('./services/analysis');
const { encryptFile, decryptFile } = require('./services/encryption');
const { recordOperation, listOperations, getDashboardStats } = require('./services/history');

const fsStream = require('fs');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadsDir),
  filename: (_req, file, callback) => callback(null, `${Date.now()}-${sanitizeName(file.originalname)}`),
});

const upload = multer({ storage });

function getTtlMs() {
  return Number(process.env.FILE_TTL_MINUTES || 10) * 60 * 1000;
}

async function sendDownload(res, filePath, downloadName, tokenLabel = 'download') {
  const token = createDownloadToken(filePath, downloadName, getTtlMs());
  let size = 0;
  try {
    const stats = await fs.stat(filePath);
    size = stats.size;
  } catch (err) {
    // ignore, size stays 0
  }

  res.json({
    ok: true,
    token,
    downloadUrl: `/api/download/${token}`,
    downloadName,
    tokenLabel,
    outputSize: size,
  });
}

async function readOutputSize(filePath) {
  const stats = await fs.stat(filePath);
  return stats.size;
}

router.get('/history', async (_req, res, next) => {
  try {
    const history = await listOperations(25);
    res.json({ ok: true, history });
  } catch (error) {
    next(error);
  }
});

router.get('/dashboard', async (_req, res, next) => {
  try {
    const dashboard = await getDashboardStats();
    res.json({ ok: true, ...dashboard });
  } catch (error) {
    next(error);
  }
});

router.get('/download/:token', async (req, res, next) => {
  try {
    const entry = consumeDownloadToken(req.params.token);
    if (!entry) {
      return res.status(404).json({ ok: false, message: 'Download link expired or invalid' });
    }

    const { filePath, fileName } = entry;

    // Stream file with explicit headers to ensure correct MIME and disposition
    const ext = path.extname(fileName || '').toLowerCase();
    const mimeType = ext === '.pdf' ? 'application/pdf' : ext === '.txt' ? 'text/plain' : 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const stream = fsStream.createReadStream(filePath);
    stream.on('error', (err) => {
      removeDownloadToken(req.params.token);
      next(err);
    });
    stream.on('end', () => {
      removeDownloadToken(req.params.token);
    });
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

router.post('/compress', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'File is required' });
    }

    const result = await compressFile(req.file.path, req.file.originalname);
    const originalSize = req.file.size;
    const outputSize = await readOutputSize(result.outputPath);
    const ratio = originalSize === 0 ? 0 : Number((outputSize / originalSize).toFixed(4));
    const savedBytes = Math.max(0, originalSize - outputSize);

    await recordOperation({
      type: 'compress',
      inputName: req.file.originalname,
      outputName: path.basename(result.outputPath),
      originalSize,
      outputSize,
      savedBytes,
      ratio,
      metadata: result,
    });

    cleanupTempArtifacts(req.file.path, result.outputPath);
    sendDownload(res, result.outputPath, path.basename(result.outputPath), 'compressed file');
  } catch (error) {
    next(error);
  }
});

router.post('/decompress', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'Compressed file is required' });
    }

    const result = await decompressFile(req.file.path, req.file.originalname);
    const originalSize = req.file.size;
    const outputSize = await readOutputSize(result.outputPath);
    const outputName = result.fileName ? result.fileName.replace(/\.huff$/i, '') : path.basename(result.outputPath);

    await recordOperation({
      type: 'decompress',
      inputName: req.file.originalname,
      outputName,
      originalSize,
      outputSize,
      savedBytes: 0,
      ratio: 0,
      metadata: result,
    });

    cleanupTempArtifacts(req.file.path, result.outputPath);
    sendDownload(res, result.outputPath, result.fileName || path.basename(result.outputPath), 'restored file');
  } catch (error) {
    next(error);
  }
});

router.post('/recommendation', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'File is required' });
    }

    const recommendation = await recommendCompression(req.file.path);
    cleanupTempArtifacts(req.file.path);
    res.json({ ok: true, ...recommendation });
  } catch (error) {
    next(error);
  }
});

router.post('/resume/analyze', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'Resume PDF is required' });
    }

    const analysis = await analyzeResume(req.file.path, req.body.jobDescription || '');
    cleanupTempArtifacts(req.file.path);
    res.json({ ok: true, ...analysis });
  } catch (error) {
    next(error);
  }
});

router.post('/security/encrypt', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'File is required' });
    }

    const result = await encryptFile(req.file.path, req.body.password || '', req.file.originalname);
    const outputSize = await readOutputSize(result.outputPath);
    await recordOperation({
      type: 'encrypt',
      inputName: req.file.originalname,
      outputName: path.basename(result.outputPath),
      originalSize: req.file.size,
      outputSize,
      savedBytes: 0,
      ratio: 1,
      metadata: result,
    });

    cleanupTempArtifacts(req.file.path, result.outputPath);
    sendDownload(res, result.outputPath, path.basename(result.outputPath), 'encrypted file');
  } catch (error) {
    next(error);
  }
});

router.post('/security/decrypt', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'Encrypted file is required' });
    }

    const result = await decryptFile(req.file.path, req.body.password || '', req.file.originalname);
    cleanupTempArtifacts(req.file.path, result.outputPath);
    sendDownload(res, result.outputPath, path.basename(result.outputPath), 'decrypted file');
  } catch (error) {
    next(error);
  }
});

router.post('/pdf/compress', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'PDF file is required' });
    }

    if (!/\.pdf$/i.test(req.file.originalname)) {
      return res.status(400).json({ ok: false, message: 'Only PDF files are supported.' });
    }

    const quality = String(req.body.quality || 'ebook').toLowerCase();
    const result = await compressPdf(req.file.path, req.file.originalname, quality);
    const originalSize = req.file.size;
    const outputSize = result.outputSize;
    const savedBytes = Math.max(0, originalSize - outputSize);
    const ratio = originalSize === 0 ? 0 : Number((outputSize / originalSize).toFixed(4));

    await recordOperation({
      type: 'pdf-compress',
      inputName: req.file.originalname,
      outputName: path.basename(result.outputPath),
      originalSize,
      outputSize,
      savedBytes,
      ratio,
      metadata: result,
    });

    cleanupTempArtifacts(req.file.path, result.outputPath);
    sendDownload(res, result.outputPath, path.basename(result.outputPath), 'compressed pdf');
  } catch (error) {
    next(error);
  }
});

router.post('/pdf/merge', upload.array('files', 12), async (req, res, next) => {
  try {
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ ok: false, message: 'At least two PDF files are required' });
    }

    const result = await mergePdfs(req.files.map((file) => file.path), req.body.outputName || req.files[0].originalname);
    await recordOperation({
      type: 'merge-pdf',
      inputName: req.files.map((file) => file.originalname).join(', '),
      outputName: path.basename(result.outputPath),
      originalSize: req.files.reduce((sum, file) => sum + file.size, 0),
      outputSize: result.outputSize,
      savedBytes: 0,
      ratio: 1,
      metadata: result,
    });

    cleanupTempArtifacts(req.files.map((file) => file.path).concat(result.outputPath));
    sendDownload(res, result.outputPath, path.basename(result.outputPath), 'merged pdf');
  } catch (error) {
    next(error);
  }
});

router.post('/pdf/split', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'PDF file is required' });
    }

    const result = await splitPdf(req.file.path, req.body.pages || '1', req.file.originalname);
    await recordOperation({
      type: 'split-pdf',
      inputName: req.file.originalname,
      outputName: path.basename(result.outputPath),
      originalSize: req.file.size,
      outputSize: result.outputSize,
      savedBytes: 0,
      ratio: 1,
      metadata: result,
    });

    cleanupTempArtifacts(req.file.path, result.outputPath);
    sendDownload(res, result.outputPath, path.basename(result.outputPath), 'split pdf');
  } catch (error) {
    next(error);
  }
});

router.post('/pdf/rearrange', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'PDF file is required' });
    }

    const result = await rearrangePdf(req.file.path, req.body.order || '1', req.file.originalname);
    await recordOperation({
      type: 'rearrange-pdf',
      inputName: req.file.originalname,
      outputName: path.basename(result.outputPath),
      originalSize: req.file.size,
      outputSize: result.outputSize,
      savedBytes: 0,
      ratio: 1,
      metadata: result,
    });

    cleanupTempArtifacts(req.file.path, result.outputPath);
    sendDownload(res, result.outputPath, path.basename(result.outputPath), 'rearranged pdf');
  } catch (error) {
    next(error);
  }
});

router.post('/pdf/watermark', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'PDF file is required' });
    }

    const result = await watermarkPdf(req.file.path, req.body.watermark || 'HuffZip AI', req.file.originalname);
    await recordOperation({
      type: 'watermark-pdf',
      inputName: req.file.originalname,
      outputName: path.basename(result.outputPath),
      originalSize: req.file.size,
      outputSize: result.outputSize,
      savedBytes: 0,
      ratio: 1,
      metadata: result,
    });

    cleanupTempArtifacts(req.file.path, result.outputPath);
    sendDownload(res, result.outputPath, path.basename(result.outputPath), 'watermarked pdf');
  } catch (error) {
    next(error);
  }
});

router.post('/pdf/extract-text', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'PDF file is required' });
    }

    const text = await extractPdfText(req.file.path);
    cleanupTempArtifacts(req.file.path);
    res.json({ ok: true, text, characterCount: text.length });
  } catch (error) {
    next(error);
  }
});

router.post('/pdf/summarize', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'PDF file is required' });
    }

    if (!/\.pdf$/i.test(req.file.originalname)) {
      return res.status(400).json({ ok: false, message: 'Only PDF files are supported.' });
    }

    const result = await summarizePdf(req.file.path, {
      style: req.body.style || 'brief',
      focus: req.body.focus || '',
    });

    await recordOperation({
      type: 'pdf-summarize',
      inputName: req.file.originalname,
      outputName: 'summary.txt',
      originalSize: req.file.size,
      outputSize: result.summary.length,
      savedBytes: 0,
      ratio: 1,
      metadata: { model: result.model, truncated: result.truncated },
    });

    cleanupTempArtifacts(req.file.path);
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.post('/pdf/protect', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'PDF file is required' });
    }

    const result = await protectPdf(req.file.path, req.body.password || '', req.file.originalname);
    const outputSize = await readOutputSize(result.outputPath);
    await recordOperation({
      type: 'protect-pdf',
      inputName: req.file.originalname,
      outputName: path.basename(result.outputPath),
      originalSize: req.file.size,
      outputSize,
      savedBytes: 0,
      ratio: 1,
      metadata: result,
    });

    cleanupTempArtifacts(req.file.path, result.outputPath);
    sendDownload(res, result.outputPath, path.basename(result.outputPath), 'protected pdf');
  } catch (error) {
    next(error);
  }
});

router.post('/compress/analyze', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'File is required' });
    }

    const analysis = await analyzeCompression(req.file.path, req.file.originalname);
    cleanupTempArtifacts(req.file.path);
    res.json({ ok: true, ...analysis });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
