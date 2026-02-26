import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";

export default async function AboutPage() {
  const filePath = path.join(process.cwd(), "src/content/about.md");
  const file = await fs.readFile(filePath, "utf-8");
  const { content } = matter(file);
  const rendered = await remark().use(html).process(content);

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">How It Works</h1>
        <p className="text-slate-500 mt-1 text-sm">About the Waynealytics AFL prediction model</p>
      </header>
      <article
        className="card prose max-w-3xl p-8
          prose-headings:font-extrabold prose-headings:tracking-tight prose-headings:text-slate-900
          prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
          prose-p:text-slate-600 prose-p:leading-relaxed
          prose-li:text-slate-600
          prose-a:text-blue-700 prose-a:underline
          prose-strong:text-slate-800
          prose-code:text-blue-700 prose-code:bg-blue-50 prose-code:px-1 prose-code:rounded
        "
      >
        <div dangerouslySetInnerHTML={{ __html: rendered.toString() }} />
      </article>
    </div>
  );
}
