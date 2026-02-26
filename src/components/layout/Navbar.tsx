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
    <nav style={{ background: "var(--nav-bg)" }} className="shadow-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-0">
        {/* Logo + brand */}
        <Link href="/" className="flex items-center gap-3 py-2 group">
          <Image
            src="/teams/waynealytics_aflm_tips_logo.png"
            alt="Waynealytics AFL Tips logo"
            width={52}
            height={52}
            className="rounded-full ring-2 ring-white/10 group-hover:ring-white/30 transition-all"
            priority
          />
          <div className="hidden sm:block">
            <span className="block text-white font-bold text-lg leading-tight tracking-tight">
              Waynealytics
            </span>
            <span className="block text-blue-300 text-xs font-medium tracking-widest uppercase">
              AFL Tips
            </span>
          </div>
        </Link>

        {/* Mobile menu button */}
        <button
          type="button"
          className="rounded-md border border-white/20 px-3 py-2 text-sm text-white/80 hover:text-white hover:border-white/40 transition-colors md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation menu"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            {open ? (
              <path d="M2 2L16 16M16 2L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <>
                <line x1="2" y1="4" x2="16" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="2" y1="14" x2="16" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-4 py-6 text-sm font-medium transition-colors ${
                  active
                    ? "text-white"
                    : "text-white/60 hover:text-white/90"
                }`}
              >
                {item.label}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                    style={{ background: "var(--accent)" }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-white/10 px-4 pb-3 md:hidden">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block py-3 text-sm font-medium border-b border-white/5 last:border-0 ${
                  active ? "text-white" : "text-white/60"
                }`}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
