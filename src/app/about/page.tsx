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
    <article className="prose max-w-3xl rounded-lg border border-slate-200 bg-white p-6 prose-headings:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700">
      <div dangerouslySetInnerHTML={{ __html: rendered.toString() }} />
    </article>
  );
}
