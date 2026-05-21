import { useState } from 'react';
import { formatBytes } from '../utils';

export default function UploadBox({ files, onFiles, multiple, accept }) {
  const [dragActive, setDragActive] = useState(false);

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    const selected = Array.from(event.dataTransfer.files || []);
    if (selected.length > 0) onFiles(multiple ? selected : [selected[0]]);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      className={`relative overflow-hidden rounded-2xl border-2 border-dashed p-8 text-center transition duration-300 ${
        dragActive
          ? 'border-cyan-400/60 bg-cyan-400/10'
          : 'border-white/10 bg-slate-950/40 hover:border-white/20'
      }`}
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 ring-1 ring-white/10">
        <svg className="h-7 w-7 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>
      <p className="font-medium text-white">
        {dragActive ? 'Drop to upload' : `Drop ${multiple ? 'files' : 'a file'} here`}
      </p>
      <p className="mt-1 text-sm text-slate-500">or browse from your device</p>
      <input
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={(e) => onFiles(Array.from(e.target.files || []))}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
      {files.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {files.map((file) => (
            <span
              key={`${file.name}-${file.size}`}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
            >
              {file.name} ({formatBytes(file.size)})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
