import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import ResultPanel from '../components/ResultPanel';
import Spinner from '../components/Spinner';
import UploadBox from '../components/UploadBox';
import { DEFAULT_FIELDS, QUALITY_OPTIONS, SUMMARY_STYLE_OPTIONS, getToolById } from '../tools/config';
import { API_BASE } from '../utils';

export default function ToolPage() {
  const { toolId } = useParams();
  const tool = getToolById(toolId);

  const [files, setFiles] = useState([]);
  const [fields, setFields] = useState(DEFAULT_FIELDS);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setFiles([]);
    setResult(null);
  }, [toolId]);

  if (!tool) {
    return <Navigate to="/" replace />;
  }

  async function runTool() {
    if (!files.length) {
      setResult({ ok: false, message: 'Add at least one file before running the tool.' });
      return;
    }

    const formData = new FormData();

    if (tool.id === 'merge-pdf') {
      files.forEach((f) => formData.append('files', f));
    } else {
      formData.append('file', files[0]);
    }

    if (tool.id === 'pdf-compress') formData.append('quality', fields.quality);
    if (tool.id === 'split-pdf') formData.append('pages', fields.pages);
    if (tool.id === 'rearrange-pdf') formData.append('order', fields.order);
    if (tool.id === 'watermark-pdf') formData.append('watermark', fields.watermark);
    if (['protect-pdf', 'encrypt-file', 'decrypt-file'].includes(tool.id)) {
      formData.append('password', fields.password);
    }
    if (tool.id === 'resume-analyze') formData.append('jobDescription', fields.jobDescription);
    if (tool.id === 'pdf-summarize') {
      formData.append('style', fields.summaryStyle);
      formData.append('focus', fields.summaryFocus);
    }

    setBusy(true);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}${tool.endpoint}`, { method: 'POST', body: formData });
      const payload = await response.json();

      if (payload.ok && tool.id === 'pdf-compress' && files[0]?.size && payload.outputSize) {
        payload.originalSize = files[0].size;
        payload.savedBytes = Math.max(0, files[0].size - payload.outputSize);
      }

      setResult(payload);
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-up">
      <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Link to="/" className="transition hover:text-cyan-300">
          All tools
        </Link>
        <span>/</span>
        <span className="text-slate-400">{tool.group}</span>
        <span>/</span>
        <span className="font-medium text-white">{tool.title}</span>
      </nav>

      <header className="mb-8">
        <span className={`inline-block rounded-full bg-gradient-to-r ${tool.accent} px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-950`}>
          {tool.group}
        </span>
        <h1 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">{tool.title}</h1>
        <p className="mt-3 text-slate-400">{tool.description}</p>
        <p className="mt-2 text-xs text-slate-500">
          {tool.type === 'multiple' ? 'Upload multiple files' : 'Upload a single file'}
        </p>
      </header>

      <div className="glass-panel-lg space-y-6 p-6 sm:p-8">
        <UploadBox
          files={files}
          onFiles={setFiles}
          multiple={tool.type === 'multiple'}
          accept={tool.accept}
        />

        {tool.hasQuality && (
          <div className="rounded-xl border border-white/[0.06] bg-slate-900/40 p-4">
            <p className="mb-3 text-sm font-medium text-slate-300">PDF compression level</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {QUALITY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFields((v) => ({ ...v, quality: option.id }))}
                  className={`rounded-xl border p-3 text-left transition ${
                    fields.quality === option.id
                      ? 'border-cyan-400/50 bg-cyan-400/10 ring-1 ring-cyan-400/25'
                      : 'border-white/[0.06] bg-slate-900/50 hover:border-white/15'
                  }`}
                >
                  <div className="text-sm font-semibold text-white">{option.label}</div>
                  <div className="text-xs text-slate-400">{option.detail}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {tool.id === 'split-pdf' && (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Page range</span>
              <input
                value={fields.pages}
                onChange={(e) => setFields((v) => ({ ...v, pages: e.target.value }))}
                className="input-field"
                placeholder="1-3,5"
              />
            </label>
          )}
          {tool.id === 'rearrange-pdf' && (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Page order</span>
              <input
                value={fields.order}
                onChange={(e) => setFields((v) => ({ ...v, order: e.target.value }))}
                className="input-field"
                placeholder="3,1,2"
              />
            </label>
          )}
          {tool.id === 'watermark-pdf' && (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Watermark text</span>
              <input
                value={fields.watermark}
                onChange={(e) => setFields((v) => ({ ...v, watermark: e.target.value }))}
                className="input-field"
                placeholder="Confidential"
              />
            </label>
          )}
          {['protect-pdf', 'encrypt-file', 'decrypt-file'].includes(tool.id) && (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Password</span>
              <input
                value={fields.password}
                onChange={(e) => setFields((v) => ({ ...v, password: e.target.value }))}
                className="input-field"
                placeholder="Strong password"
                type="password"
              />
            </label>
          )}
          {tool.id === 'resume-analyze' && (
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-300">Job description</span>
              <textarea
                rows={4}
                value={fields.jobDescription}
                onChange={(e) => setFields((v) => ({ ...v, jobDescription: e.target.value }))}
                className="input-field resize-y"
                placeholder="Paste role requirements for ATS scoring."
              />
            </label>
          )}
          {tool.id === 'pdf-summarize' && (
            <>
              <div className="block sm:col-span-2">
                <p className="mb-3 text-sm font-medium text-slate-300">Summary style</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {SUMMARY_STYLE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setFields((v) => ({ ...v, summaryStyle: option.id }))}
                      className={`rounded-xl border p-3 text-left transition ${
                        fields.summaryStyle === option.id
                          ? 'border-violet-400/50 bg-violet-400/10 ring-1 ring-violet-400/25'
                          : 'border-white/[0.06] bg-slate-900/50 hover:border-white/15'
                      }`}
                    >
                      <div className="text-sm font-semibold text-white">{option.label}</div>
                      <div className="text-xs text-slate-400">{option.detail}</div>
                    </button>
                  ))}
                </div>
              </div>
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-300">Focus (optional)</span>
                <input
                  value={fields.summaryFocus}
                  onChange={(e) => setFields((v) => ({ ...v, summaryFocus: e.target.value }))}
                  className="input-field"
                  placeholder="e.g. financial results, methodology, action items"
                />
              </label>
              <p className="sm:col-span-2 text-xs text-slate-500">
                Requires <code className="text-slate-400">GEMINI_API_KEY</code> in the server <code className="text-slate-400">.env</code> file.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-3 border-t border-white/[0.06] pt-6">
          <button type="button" onClick={runTool} disabled={busy} className="btn-primary disabled:opacity-50">
            {busy && <Spinner className="text-slate-950" />}
            {busy ? 'Processing…' : tool.id === 'pdf-summarize' ? 'Summarize PDF' : 'Run tool'}
          </button>
          <button
            type="button"
            onClick={() => { setFiles([]); setResult(null); }}
            className="btn-secondary"
          >
            Reset
          </button>
          <Link to="/" className="btn-secondary">
            ← All tools
          </Link>
        </div>

        <ResultPanel result={result} apiBase={API_BASE} tool={tool} />
      </div>
    </main>
  );
}
