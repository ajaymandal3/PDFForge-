import { Link } from 'react-router-dom';
import { TOOL_GROUPS, getToolPath } from '../tools/config';

function ToolCard({ tool }) {
  return (
    <Link
      to={getToolPath(tool.id)}
      className="group glass-panel block p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-400/30 hover:shadow-glow-lg"
    >
      <span className={`inline-block rounded-full bg-gradient-to-r ${tool.accent} px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-slate-950`}>
        {tool.id.replace(/-/g, ' ')}
      </span>
      <h3 className="mt-3 text-lg font-bold text-white group-hover:text-cyan-100 transition">{tool.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{tool.description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-cyan-400/80 transition group-hover:text-cyan-300">
        Open tool →
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="animate-fade-up mb-14 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-1.5 text-sm font-medium text-cyan-200">
          Choose a tool to get started
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          <span className="gradient-text">PDFForge</span>
          <span className="text-white"> document studio</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
          Select any tool below — each opens its own page where you can upload files and run that feature.
        </p>
      </section>

      <div className="space-y-12">
        {TOOL_GROUPS.map((group, groupIndex) => (
          <section key={group.label} className={`animate-fade-up stagger-${groupIndex + 1}`}>
            <h2 className="mb-5 text-sm font-bold uppercase tracking-[0.4em] text-slate-500">{group.label}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
