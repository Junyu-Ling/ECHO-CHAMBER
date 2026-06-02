export function Footer() {
  return (
    <footer
      className="py-12 px-6"
      style={{ background: "#07070C", borderTop: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <span
            style={{ fontFamily: "'Anton', sans-serif", fontSize: "1.25rem", letterSpacing: "0.08em" }}
            className="text-foreground"
          >
            ECHO
          </span>
          <span
            style={{ fontFamily: "'Anton', sans-serif", fontSize: "1.25rem", letterSpacing: "0.08em", color: "#FF9FD4" }}
          >
            CHAMBER
          </span>
        </div>

        <p className="text-muted-foreground text-xs opacity-50">
          © 2026 ECHO CHAMBER. All rights reserved.
        </p>
      </div>
    </footer>
  );
}