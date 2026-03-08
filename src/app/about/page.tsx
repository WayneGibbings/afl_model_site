import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";

export default async function AboutPage() {
  const filePath = path.join(process.cwd(), "src/content/about.md");
  const file = await fs.readFile(filePath, "utf-8");
  const { content } = matter(file);
  const rendered = await remark().use(html, { sanitize: false }).process(content);

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">How It Works</h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
          About the Waynealytics AFL prediction model
        </p>
      </header>
      <article
        className="about-prose card prose max-w-3xl p-4 sm:p-8
          prose-headings:font-bold prose-headings:tracking-tight
          prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
          prose-p:leading-relaxed
          prose-strong:font-semibold
          prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded
          prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:border prose-pre:border-slate-700 prose-pre:rounded-xl prose-pre:shadow-sm
        "
        style={{
          // @ts-expect-error CSS custom property usage
          "--tw-prose-body": "var(--muted)",
          "--tw-prose-headings": "var(--foreground)",
          "--tw-prose-links": "var(--brand)",
          "--tw-prose-bold": "var(--foreground)",
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: rendered.toString() }} />
      </article>
    </div>
  );
}
