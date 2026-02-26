"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/tips", label: "Tips" },
  { href: "/ladder", label: "Ladder" },
  { href: "/accuracy", label: "Accuracy" },
  { href: "/about", label: "How It Works" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav
      className="shadow-lg relative"
      style={{
        background: "linear-gradient(135deg, var(--nav-bg) 0%, var(--brand-dark) 100%)",
      }}
    >
      {/* Subtle gold accent line at bottom of nav */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, var(--gold) 0%, transparent 60%)",
          opacity: 0.5,
        }}
      />

      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-0">
        {/* Logo — full branded image */}
        <Link href="/" className="flex items-center py-2.5 group">
          <Image
            src="/teams/waynealytics_logo_full.png"
            alt="Waynealytics AFLM Tips"
            width={200}
            height={48}
            className="h-10 w-auto sm:h-12 transition-opacity group-hover:opacity-90"
            priority
          />
        </Link>

        {/* Mobile menu button */}
        <button
          type="button"
          className="rounded-lg border border-white/15 p-2.5 text-white/70 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation menu"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {open ? (
              <path
                d="M3 3L17 17M17 3L3 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <>
                <line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="3" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>

        {/* Desktop nav */}
        <div className="hidden items-center gap-0.5 md:flex">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-4 py-6 text-sm font-medium transition-colors ${
                  active
                    ? "text-white"
                    : "text-white/50 hover:text-white/85"
                }`}
              >
                {item.label}
                {active && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-t"
                    style={{ background: "var(--gold)" }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="border-t border-white/10 px-4 pb-3 md:hidden"
          style={{ background: "rgba(7, 26, 32, 0.6)", backdropFilter: "blur(12px)" }}
        >
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 py-3.5 text-sm font-medium border-b border-white/5 last:border-0 transition-colors ${
                  active ? "text-white" : "text-white/50 hover:text-white/80"
                }`}
                onClick={() => setOpen(false)}
              >
                {active && (
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--gold)" }}
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
