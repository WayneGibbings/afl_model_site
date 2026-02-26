export function Footer() {
  return (
    <footer style={{ background: "var(--nav-bg)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="mx-auto max-w-6xl px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-sm text-white/40">
          &copy; {new Date().getFullYear()} Waynealytics AFL Tips
        </p>
        <p className="text-xs text-white/25">
          Data refreshed via Databricks pipeline
        </p>
      </div>
    </footer>
  );
}
