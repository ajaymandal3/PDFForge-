const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts } = require('pdf-lib');

async function make() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 200]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('PDFForge Test', { x: 50, y: 100, size: 24, font });
  const bytes = await doc.save();
  const outDir = path.join(__dirname, '..', '..', 'temp');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) {}
  const outPath = path.join(outDir, 'test.pdf');
  fs.writeFileSync(outPath, bytes);
  console.log(outPath);
}

make().catch((e) => { console.error(e); process.exit(1); });
