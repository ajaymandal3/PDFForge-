import { formatBytes } from '../utils';

export default function ResultPanel({ result, apiBase, tool }) {
  if (!result) return null;

  const isError = result.ok === false;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        isError ? 'border-rose-400/30 bg-rose-500/10' : 'border-emerald-400/30 bg-emerald-500/10'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
            isError ? 'bg-rose-400/20' : 'bg-emerald-400/20'
          }`}
        >
          {isError ? (
            <svg className="h-6 w-6 text-rose-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-white">{isError ? 'Error' : 'Done'}</h4>
          <p className="mt-1 text-sm text-slate-300">
            {isError
              ? result.message
              : result.summary
                ? `Summary generated${result.model ? ` with ${result.model}` : ''}${result.truncated ? ' (document was truncated)' : ''}.`
                : result.text
                  ? `Extracted ${result.characterCount ?? result.text.length} characters.`
                  : result.savedBytes > 0
                    ? `Saved ${formatBytes(result.savedBytes)} (${formatBytes(result.originalSize)} → ${formatBytes(result.outputSize)})`
                    : result.tokenLabel
                      ? `${result.tokenLabel} is ready.`
                      : 'Your file is ready.'}
          </p>

          {result.ok && result.downloadUrl && (
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`${apiBase}${result.downloadUrl}`}
                download={result.downloadName || ''}
                className="btn-primary !py-2 !px-4 text-sm"
              >
                Download
              </a>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(`${apiBase}${result.downloadUrl}`)}
                className="btn-secondary !py-2 !px-4 text-sm"
              >
                Copy link
              </button>
            </div>
          )}

          {result.ok && result.summary && (
            <div className="mt-4 space-y-3">
              <div className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950/80 p-4 text-sm leading-relaxed text-slate-200">
                {result.summary}
              </div>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(result.summary)}
                className="btn-secondary !py-2 !px-4 text-sm"
              >
                Copy summary
              </button>
            </div>
          )}

          {result.ok && !result.summary && (tool.jsonResult || result.text) && (
            <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950/80 p-3 text-xs text-slate-300">
              {result.text ?? JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
