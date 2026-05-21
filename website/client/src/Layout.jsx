import { NavLink, Outlet } from 'react-router-dom';
import PageShell from './components/PageShell';

const APP_NAME = 'PDFForge';

function Logo() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 shadow-lg shadow-cyan-500/25">
      <svg className="h-5 w-5 text-slate-950" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm8 1.5V8h4.5L14 3.5zM8 12h8v1.5H8V12zm0 4h8v1.5H8V16z" />
      </svg>
    </div>
  );
}

export default function Layout({ onToggleTheme, darkMode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#060b14]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <NavLink to="/" className="group flex items-center gap-3">
            <Logo />
            <div>
              <div className="text-lg font-bold tracking-tight text-white group-hover:text-cyan-100 transition">{APP_NAME}</div>
              <div className="hidden text-xs text-slate-500 sm:block">PDF & document studio</div>
            </div>
          </NavLink>

          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `hidden rounded-full px-4 py-2 text-sm font-medium transition sm:inline-block ${
                isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
              }`
            }
          >
            All tools
          </NavLink>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200"
          >
            {darkMode ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <PageShell>
        <Outlet />
      </PageShell>

      <footer className="relative z-10 mt-auto border-t border-white/[0.06] bg-slate-950/40 py-6">
        <p className="text-center text-sm text-slate-500">
          © {new Date().getFullYear()} {APP_NAME} — compress, transform, and secure documents locally.
        </p>
      </footer>
    </div>
  );
}
