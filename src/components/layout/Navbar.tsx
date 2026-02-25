"use client";

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
    <nav className="bg-slate-800 text-slate-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          AFL Predictions
        </Link>
        <button
          type="button"
          className="rounded border border-slate-400 px-3 py-1 text-sm md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label="Toggle navigation menu"
        >
          Menu
        </button>
        <div className="hidden items-center gap-4 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-1 py-2 text-sm transition-colors ${
                pathname === item.href ? "border-b-2 border-blue-400 text-blue-300" : "text-slate-200 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      {open ? (
        <div className="border-t border-slate-700 px-4 py-2 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block py-2 text-sm ${pathname === item.href ? "text-blue-300" : "text-slate-200"}`}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </nav>
  );
}
