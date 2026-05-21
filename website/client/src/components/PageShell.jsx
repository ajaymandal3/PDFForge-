export default function PageShell({ children, className = '' }) {
  return (
    <div className={`relative min-h-[calc(100vh-5rem)] overflow-hidden ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-grid bg-[size:48px_48px] opacity-[0.07] animate-grid-drift" />
      <div className="pointer-events-none absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-cyan-500/25 blur-[100px] animate-float-slow" />
      <div className="pointer-events-none absolute -right-20 top-32 h-[24rem] w-[24rem] rounded-full bg-violet-500/20 blur-[100px] animate-float-slower" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-[20rem] w-[20rem] rounded-full bg-emerald-500/15 blur-[90px]" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
