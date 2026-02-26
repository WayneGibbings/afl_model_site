import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Waynealytics AFL Tips",
  description: "AFL match tips, predicted ladders, and model accuracy tracking by Waynealytics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU" className={inter.variable}>
      <body>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="mx-auto w-full max-w-6xl px-4 py-4 sm:py-8 flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
