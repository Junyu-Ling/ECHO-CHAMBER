export function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <div
        className="text-xs uppercase tracking-[0.3em] px-3 py-1"
        style={{ color: "#FF9FD4", border: "1px solid rgba(255,159,212,0.3)", background: "rgba(255,159,212,0.05)" }}
      >
        {label}
      </div>
      <h2
        className="text-foreground leading-none"
        style={{
          fontFamily: "'Anton', sans-serif",
          fontSize: "clamp(2.5rem, 6vw, 5rem)",
          letterSpacing: "0.04em",
        }}
      >
        {title}
      </h2>
      <div className="w-16 h-px" style={{ background: "#FF9FD4" }} />
    </div>
  );
}
