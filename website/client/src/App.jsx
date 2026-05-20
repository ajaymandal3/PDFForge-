import { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const TOOL_GROUPS = [
  {
    label: 'Compression',
    tools: [
      {
        id: 'compress',
        title: 'Huffman Compress',
        description: 'Compress PDFs and text files with the custom C++ engine.',
        endpoint: '/api/compress',
        type: 'single',
        accent: 'from-cyan-400 to-sky-500',
      },
      {
        id: 'decompress',
        title: 'Decompress Archive',
        description: 'Restore a .huff archive back to its original content.',
        endpoint: '/api/decompress',
        type: 'single',
        accent: 'from-emerald-400 to-teal-500',
      },
      {
        id: 'recommendation',
        title: 'Compression Advisor',
        description: 'Choose between Huffman and RLE using entropy heuristics.',
        endpoint: '/api/compress/analyze',
        type: 'single',
        accent: 'from-slate-200 to-slate-400',
      },
    ],
  },
  {
    label: 'PDF Toolkit',
    tools: [
      {
        id: 'merge-pdf',
        title: 'Merge PDFs',
        description: 'Combine multiple PDFs into one clean document.',
        endpoint: '/api/pdf/merge',
        type: 'multiple',
        accent: 'from-indigo-400 to-violet-500',
      },
      {
        id: 'split-pdf',
        title: 'Split PDF',
        description: 'Extract a custom page range into a new file.',
        endpoint: '/api/pdf/split',
        type: 'single',
        accent: 'from-fuchsia-400 to-pink-500',
      },
      {
        id: 'rearrange-pdf',
        title: 'Rearrange Pages',
        description: 'Reorder document pages without external services.',
        endpoint: '/api/pdf/rearrange',
        type: 'single',
        accent: 'from-orange-400 to-amber-500',
      },
      {
        id: 'watermark-pdf',
        title: 'Add Watermark',
        description: 'Stamp a professional overlay on every page.',
        endpoint: '/api/pdf/watermark',
        type: 'single',
        accent: 'from-cyan-300 to-teal-500',
      },
      {
        id: 'extract-text',
        title: 'Extract Text',
        description: 'Read PDF content and expose plain text instantly.',
        endpoint: '/api/pdf/extract-text',
        type: 'single',
        accent: 'from-lime-400 to-emerald-500',
      },
      {
        id: 'protect-pdf',
        title: 'Password Protect',
        description: 'Store a protected AES-wrapped PDF package.',
        endpoint: '/api/pdf/protect',
        type: 'single',
        accent: 'from-slate-300 to-slate-500',
      },
    ],
  },
  {
    label: 'Smart + Security',
    tools: [
      {
        id: 'resume-analyze',
        title: 'Resume Analyzer',
        description: 'Extract skills and compute an ATS-style score.',
        endpoint: '/api/resume/analyze',
        type: 'single',
        accent: 'from-emerald-300 to-cyan-500',
      },
      {
        id: 'encrypt-file',
        title: 'AES Encrypt',
        description: 'Encrypt any uploaded file before sharing it.',
        endpoint: '/api/security/encrypt',
        type: 'single',
        accent: 'from-rose-400 to-orange-500',
      },
      {
        id: 'decrypt-file',
        title: 'AES Decrypt',
        description: 'Restore an encrypted artifact with a passphrase.',
        endpoint: '/api/security/decrypt',
        type: 'single',
        accent: 'from-sky-400 to-indigo-500',
      },
    ],
  },
];

const FLATTENED_TOOLS = TOOL_GROUPS.flatMap((group) => group.tools);

const DEFAULT_FIELDS = {
  pages: '1',
  order: '1',
  watermark: 'Confidential',
  password: 'PDFForge-1234',
  jobDescription: 'React Node.js MongoDB C++ data structures algorithms PDF security',
  outputName: '',
};

function formatBytes(bytes) {
  if (!bytes) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function Metric({ label, value, detail }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur-xl">
      <div className="text-xs uppercase tracking-[0.35em] text-slate-400">{label}</div>
      <div className="mt-3 text-3xl font-extrabold text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-300">{detail}</div>
    </div>
  );
}

function ToolChip({ tool, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition duration-200 ${active ? 'border-cyan-400/60 bg-cyan-400/10 shadow-glow' : 'border-white/10 bg-slate-900/60 hover:border-white/20 hover:bg-slate-900/80'}`}
    >
      <div className={`mb-3 inline-flex rounded-full bg-gradient-to-r ${tool.accent} px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-950`}>
        {tool.id.replace('-', ' ')}
      </div>
      <div className="text-lg font-bold text-white">{tool.title}</div>
      <p className="mt-1 text-sm text-slate-300">{tool.description}</p>
    </button>
  );
}

function UploadBox({ files, onFiles, multiple }) {
  const [dragActive, setDragActive] = useState(false);

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    const selected = Array.from(event.dataTransfer.files || []);
    if (selected.length > 0) {
      onFiles(multiple ? selected : [selected[0]]);
    }
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      className={`rounded-3xl border border-dashed p-6 transition ${dragActive ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/15 bg-slate-900/50'}`}
    >
      <input
        type="file"
        multiple={multiple}
        onChange={(event) => onFiles(Array.from(event.target.files || []))}
        className="mb-4 block w-full cursor-pointer rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200 file:mr-4 file:rounded-full file:border-0 file:bg-cyan-400 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
      />
      <div className="text-sm text-slate-300">Drag and drop {multiple ? 'multiple files' : 'a file'} here or use the picker above.</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {files.map((file) => (
          <span key={`${file.name}-${file.size}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
            {file.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [selectedToolId, setSelectedToolId] = useState('compress');
  const [files, setFiles] = useState([]);
  const [fields, setFields] = useState(DEFAULT_FIELDS);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dashboard, setDashboard] = useState({ totals: {}, recentOperations: [] });
  const [fetchError, setFetchError] = useState('');

  const selectedTool = useMemo(() => FLATTENED_TOOLS.find((tool) => tool.id === selectedToolId) || FLATTENED_TOOLS[0], [selectedToolId]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    fetch(`${API_BASE}/api/dashboard`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.ok) {
          setDashboard(payload);
        }
      })
      .catch(() => setFetchError('Dashboard will populate after the backend starts.'));
  }, []);

  useEffect(() => {
    setResult(null);
    setFiles([]);
  }, [selectedToolId]);

  async function submitTool() {
    if (!files.length) {
      setResult({ ok: false, message: 'Add at least one file before running the tool.' });
      return;
    }

    const formData = new FormData();
    if (selectedTool.id === 'merge-pdf') {
      files.forEach((file) => formData.append('files', file));
    } else {
      formData.append('file', files[0]);
    }

    if (selectedTool.id === 'split-pdf') {
      formData.append('pages', fields.pages);
    }

    if (selectedTool.id === 'rearrange-pdf') {
      formData.append('order', fields.order);
    }

    if (selectedTool.id === 'watermark-pdf') {
      formData.append('watermark', fields.watermark);
    }

    if (selectedTool.id === 'protect-pdf' || selectedTool.id === 'encrypt-file' || selectedTool.id === 'decrypt-file') {
      formData.append('password', fields.password);
    }

    if (selectedTool.id === 'resume-analyze') {
      formData.append('jobDescription', fields.jobDescription);
    }

    setBusy(true);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}${selectedTool.endpoint}`, {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();
      setResult(payload);
      if (payload.ok) {
        fetch(`${API_BASE}/api/dashboard`)
          .then((response) => response.json())
          .then((fresh) => {
            if (fresh.ok) {
              setDashboard(fresh);
            }
          })
          .catch(() => null);
      }
    } catch (error) {
      setResult({ ok: false, message: error.message });
    } finally {
      setBusy(false);
    }
  }

  const totals = dashboard.totals || {};

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid bg-[size:64px_64px] opacity-[0.16]" />
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl" />

      <header className="relative z-10 border-b border-white/10 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <div className="text-xs uppercase tracking-[0.5em] text-cyan-300">PDFForge</div>
            <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">Modern PDF & Document Studio</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">Fast, secure document automation</span>
            <button
              type="button"
              onClick={() => setDarkMode((value) => !value)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
            >
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr] lg:items-center">
          <div>
            <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200">
              Create, transform, and secure documents with one workspace
            </div>
            <h2 className="mt-6 max-w-3xl text-5xl font-black leading-tight text-white sm:text-6xl">
              Manage PDFs with a clean, modern workspace.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              PDFForge brings together compression, PDF utilities, secure file handling, and automation in one focused product experience.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#workspace" className="rounded-full bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300">
                Open Workspace
              </a>
              <a href="#dashboard" className="rounded-full border border-white/10 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10">
                View Dashboard
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-glow backdrop-blur-xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <Metric label="Operations" value={totals.operations || 0} detail="Recent actions tracked in the activity feed." />
              <Metric label="Storage Saved" value={formatBytes(totals.savedBytes || 0)} detail="Compression savings from Huffman runs." />
              <Metric label="Avg Ratio" value={(totals.averageRatio || 0).toFixed(2)} detail="Output size divided by input size." />
              <Metric label="API Status" value="Ready" detail={fetchError || 'Dashboard and tool endpoints are wired.'} />
            </div>
          </div>
        </section>

        <section id="workspace" className="mt-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            {TOOL_GROUPS.map((group) => (
              <div key={group.label} className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                <div className="px-1 text-xs uppercase tracking-[0.4em] text-slate-400">{group.label}</div>
                <div className="grid gap-3">
                  {group.tools.map((tool) => (
                    <ToolChip key={tool.id} tool={tool} active={selectedToolId === tool.id} onClick={() => setSelectedToolId(tool.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-6 rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-glow backdrop-blur-xl">
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-cyan-300">Selected Tool</div>
              <h3 className="mt-2 text-3xl font-black text-white">{selectedTool.title}</h3>
              <p className="mt-2 text-slate-300">{selectedTool.description}</p>
            </div>

            <UploadBox files={files} onFiles={setFiles} multiple={selectedTool.type === 'multiple'} />

            <div className="grid gap-4 sm:grid-cols-2">
              {selectedTool.id === 'split-pdf' && (
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-200">Page Range</span>
                  <input
                    value={fields.pages}
                    onChange={(event) => setFields((value) => ({ ...value, pages: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-400"
                    placeholder="1-3,5"
                  />
                </label>
              )}

              {selectedTool.id === 'rearrange-pdf' && (
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-200">Page Order</span>
                  <input
                    value={fields.order}
                    onChange={(event) => setFields((value) => ({ ...value, order: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-slate-100 outline-none ring-0 focus:border-cyan-400"
                    placeholder="3,1,2"
                  />
                </label>
              )}

              {(selectedTool.id === 'watermark-pdf' || selectedTool.id === 'protect-pdf' || selectedTool.id === 'encrypt-file' || selectedTool.id === 'decrypt-file') && (
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-200">Watermark / Password</span>
                  <input
                    value={selectedTool.id === 'watermark-pdf' ? fields.watermark : fields.password}
                    onChange={(event) => setFields((value) => ({ ...value, [selectedTool.id === 'watermark-pdf' ? 'watermark' : 'password']: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-slate-100 outline-none ring-0 focus:border-cyan-400"
                    placeholder={selectedTool.id === 'watermark-pdf' ? 'Confidential' : 'Strong password'}
                  />
                </label>
              )}

              {selectedTool.id === 'resume-analyze' && (
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-semibold text-slate-200">Job Description</span>
                  <textarea
                    rows="4"
                    value={fields.jobDescription}
                    onChange={(event) => setFields((value) => ({ ...value, jobDescription: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-slate-100 outline-none ring-0 focus:border-cyan-400"
                    placeholder="Paste role requirements to generate an ATS score."
                  />
                </label>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={submitTool}
                disabled={busy}
                className="rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Processing...' : 'Run Tool'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  setResult(null);
                }}
                className="rounded-full border border-white/10 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Reset
              </button>
            </div>

            {result && (
              <div className={`rounded-3xl border p-5 ${result.ok === false ? 'border-rose-400/30 bg-rose-400/10' : 'border-emerald-400/30 bg-emerald-400/10'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm uppercase tracking-[0.35em] text-slate-300">Result</div>
                    <h4 className="mt-2 text-lg font-bold text-white">{result.ok ? 'Done' : 'Error'}</h4>
                    <p className="mt-1 text-sm text-slate-200">{result.ok ? (result.tokenLabel ? `${result.tokenLabel} is ready to download.` : 'Your file is ready.') : result.message}</p>
                  </div>
                  <div>
                    {result.ok ? (
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/10">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-400/10">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-rose-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {result.ok && result.downloadUrl ? (
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-300">File</div>
                      <div className="mt-1 truncate font-medium text-white">{result.downloadName || 'downloaded-file'}</div>
                      {result.outputSize && (
                        <div className="mt-1 text-xs text-slate-400">Size: {formatBytes(result.outputSize)}</div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <a
                        href={`${API_BASE}${result.downloadUrl}`}
                        download={result.downloadName || ''}
                        className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300"
                      >
                        Download
                      </a>

                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(`${API_BASE}${result.downloadUrl}`)}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold text-white"
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <pre className="overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950/80 p-4 text-sm text-slate-100">{JSON.stringify(result, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section id="dashboard" className="mt-12 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.35em] text-cyan-300">Dashboard</div>
                <h3 className="mt-2 text-3xl font-black text-white">Recent activity</h3>
              </div>
              <div className="rounded-full border border-white/10 bg-slate-950/80 px-4 py-2 font-mono text-xs text-slate-300">/api/dashboard</div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Metric label="Total Saved" value={formatBytes(totals.savedBytes || 0)} detail="Space recovered from compression runs." />
              <Metric label="Original Data" value={formatBytes(totals.originalBytes || 0)} detail="Raw input tracked across jobs." />
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-glow backdrop-blur-xl">
            <h3 className="text-2xl font-black text-white">Latest operations</h3>
            <div className="mt-5 space-y-3">
              {(dashboard.recentOperations || []).map((operation) => (
                <div key={operation.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-white">{operation.type}</div>
                    <div className="font-mono text-xs text-slate-400">{operation.ratio ? `ratio ${Number(operation.ratio).toFixed(2)}` : 'processed'}</div>
                  </div>
                  <div className="mt-2 text-sm text-slate-300">{operation.inputName} → {operation.outputName}</div>
                  <div className="mt-2 text-xs text-slate-400">Saved {formatBytes(operation.savedBytes || 0)} | Output {formatBytes(operation.outputSize || 0)}</div>
                </div>
              ))}
              {(!dashboard.recentOperations || dashboard.recentOperations.length === 0) && (
                <div className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-slate-400">
                  Run a tool to populate the history feed.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
