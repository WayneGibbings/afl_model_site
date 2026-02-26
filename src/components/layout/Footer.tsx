export function Footer() {
  return (
    <footer
      className="relative"
      style={{
        background: "linear-gradient(135deg, var(--nav-bg) 0%, var(--brand-dark) 100%)",
      }}
    >
      {/* Gold accent line at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, transparent 20%, var(--gold) 50%, transparent 80%)",
          opacity: 0.3,
        }}
      />

      <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-sm text-white/40 font-medium">
          &copy; {new Date().getFullYear()} Waynealytics
        </p>
        <p className="text-xs text-white/20">
          Data refreshed via Databricks pipeline
        </p>
      </div>
    </footer>
  );
}
