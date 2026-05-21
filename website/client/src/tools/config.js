export const TOOL_GROUPS = [
  {
    label: 'PDF',
    tools: [
      { id: 'pdf-compress', title: 'Compress PDF', description: 'Reduce PDF size — output stays a PDF.', endpoint: '/api/pdf/compress', type: 'single', accept: '.pdf,application/pdf', accent: 'from-cyan-400 to-sky-500', hasQuality: true },
      { id: 'merge-pdf', title: 'Merge PDFs', description: 'Combine multiple PDFs into one.', endpoint: '/api/pdf/merge', type: 'multiple', accept: '.pdf,application/pdf', accent: 'from-indigo-400 to-violet-500' },
      { id: 'split-pdf', title: 'Split PDF', description: 'Extract a page range into a new file.', endpoint: '/api/pdf/split', type: 'single', accept: '.pdf,application/pdf', accent: 'from-fuchsia-400 to-pink-500' },
      { id: 'rearrange-pdf', title: 'Rearrange', description: 'Reorder pages in your document.', endpoint: '/api/pdf/rearrange', type: 'single', accept: '.pdf,application/pdf', accent: 'from-orange-400 to-amber-500' },
      { id: 'watermark-pdf', title: 'Watermark', description: 'Stamp text on every page.', endpoint: '/api/pdf/watermark', type: 'single', accept: '.pdf,application/pdf', accent: 'from-cyan-300 to-teal-500' },
      { id: 'extract-text', title: 'Extract Text', description: 'Read PDF content as plain text.', endpoint: '/api/pdf/extract-text', type: 'single', accept: '.pdf,application/pdf', accent: 'from-lime-400 to-emerald-500', jsonResult: true },
      { id: 'pdf-summarize', title: 'PDF Summarizer', description: 'AI summary powered by Google Gemini.', endpoint: '/api/pdf/summarize', type: 'single', accept: '.pdf,application/pdf', accent: 'from-violet-400 to-fuchsia-500', jsonResult: true, summaryResult: true },
      { id: 'protect-pdf', title: 'Protect PDF', description: 'Password-protect with AES.', endpoint: '/api/pdf/protect', type: 'single', accept: '.pdf,application/pdf', accent: 'from-slate-300 to-slate-500' },
    ],
  },
  {
    label: 'Archive Compression',
    tools: [
      { id: 'compress', title: 'Compress to .huff', description: 'Lossless archive (PDF/text) — not a smaller PDF.', endpoint: '/api/compress', type: 'single', accept: '*/*', accent: 'from-cyan-400 to-emerald-400' },
      { id: 'decompress', title: 'Decompress .huff', description: 'Restore a .huff archive to original.', endpoint: '/api/decompress', type: 'single', accept: '.huff', accent: 'from-emerald-400 to-teal-500' },
      { id: 'recommendation', title: 'Compression Advisor', description: 'Huffman vs RLE recommendation.', endpoint: '/api/compress/analyze', type: 'single', accept: '*/*', accent: 'from-slate-300 to-slate-500', jsonResult: true },
    ],
  },
  {
    label: 'Smart + Security',
    tools: [
      { id: 'resume-analyze', title: 'Resume Analyzer', description: 'ATS-style score vs job description.', endpoint: '/api/resume/analyze', type: 'single', accept: '.pdf,application/pdf', accent: 'from-emerald-300 to-cyan-500', jsonResult: true },
      { id: 'encrypt-file', title: 'AES Encrypt', description: 'Encrypt any file before sharing.', endpoint: '/api/security/encrypt', type: 'single', accept: '*/*', accent: 'from-rose-400 to-orange-500' },
      { id: 'decrypt-file', title: 'AES Decrypt', description: 'Decrypt with your passphrase.', endpoint: '/api/security/decrypt', type: 'single', accept: '.aes', accent: 'from-sky-400 to-indigo-500' },
    ],
  },
];

export const FLATTENED_TOOLS = TOOL_GROUPS.flatMap((group) =>
  group.tools.map((tool) => ({ ...tool, group: group.label })),
);

export const QUALITY_OPTIONS = [
  { id: 'screen', label: 'Maximum', detail: 'Smallest file' },
  { id: 'ebook', label: 'Balanced', detail: 'Recommended' },
  { id: 'printer', label: 'High quality', detail: 'Larger output' },
];

export const DEFAULT_FIELDS = {
  pages: '1',
  order: '1',
  watermark: 'Confidential',
  password: 'PDFForge-1234',
  jobDescription: 'React Node.js MongoDB C++ data structures algorithms PDF security',
  quality: 'ebook',
  summaryStyle: 'brief',
  summaryFocus: '',
};

export const SUMMARY_STYLE_OPTIONS = [
  { id: 'brief', label: 'Brief', detail: 'Short overview' },
  { id: 'detailed', label: 'Detailed', detail: 'In-depth summary' },
  { id: 'bullets', label: 'Bullet points', detail: 'Grouped list' },
];

export function getToolById(toolId) {
  return FLATTENED_TOOLS.find((tool) => tool.id === toolId);
}

export function getToolPath(toolId) {
  return `/tools/${toolId}`;
}
