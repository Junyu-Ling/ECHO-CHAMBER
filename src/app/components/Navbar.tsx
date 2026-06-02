import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "首页", href: "#home" },
  { label: "演出视频", href: "#videos" },
  { label: "成员介绍", href: "#members" },
  { label: "点歌留言", href: "#requests" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLink = (href: string) => {
    setMenuOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-400"
      style={{
        background: scrolled ? "rgba(7,7,12,0.95)" : "transparent",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
        backdropFilter: scrolled ? "blur(16px)" : "none",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <button onClick={() => handleLink("#home")} className="flex items-center gap-1">
          <span
            style={{ fontFamily: "'Anton', sans-serif", fontSize: "1.15rem", letterSpacing: "0.1em" }}
            className="text-foreground"
          >
            ECHO
          </span>
          <span
            style={{ fontFamily: "'Anton', sans-serif", fontSize: "1.15rem", letterSpacing: "0.1em", color: "#FF9FD4" }}
          >
            CHAMBER
          </span>
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => handleLink(link.href)}
              className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              {link.label}
            </button>
          ))}
          <button
            onClick={() => handleLink("#requests")}
            className="ml-2 px-4 py-2 text-xs uppercase tracking-[0.18em] transition-all duration-200 hover:opacity-85 active:scale-95"
            style={{
              background: "#FF9FD4",
              color: "#07070C",
              fontFamily: "'Anton', sans-serif",
              letterSpacing: "0.15em",
            }}
          >
            立即点歌
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-foreground p-1.5"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="md:hidden px-6 pt-2 pb-6 flex flex-col gap-1"
          style={{ background: "rgba(7,7,12,0.98)", backdropFilter: "blur(16px)" }}
        >
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => handleLink(link.href)}
              className="text-left py-3 text-sm uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors duration-150"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              {link.label}
            </button>
          ))}
          <button
            onClick={() => handleLink("#requests")}
            className="mt-4 py-3 text-sm uppercase tracking-[0.18em] transition-all duration-200"
            style={{
              background: "#FF9FD4",
              color: "#07070C",
              fontFamily: "'Anton', sans-serif",
            }}
          >
            立即点歌
          </button>
        </div>
      )}
    </nav>
  );
}