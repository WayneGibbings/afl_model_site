export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">Privacy Policy</h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
          Last updated March 2026
        </p>
      </header>

      <article
        className="card prose max-w-3xl p-4 sm:p-8
          prose-headings:font-bold prose-headings:tracking-tight
          prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
          prose-p:leading-relaxed
          prose-strong:font-semibold
        "
        style={{
          // @ts-expect-error CSS custom property usage
          "--tw-prose-body": "var(--muted)",
          "--tw-prose-headings": "var(--foreground)",
          "--tw-prose-bold": "var(--foreground)",
        }}
      >
        <h2>Overview</h2>
        <p>
          Waynealytics is a personal AFL tipping and analysis site. This policy explains what
          information is handled when you use the site.
        </p>

        <h2>Ask / Chat</h2>
        <p>
          Questions submitted through the <strong>Ask</strong> page are sent to a Databricks Genie
          instance to generate answers. These questions are visible to the site owner and may be
          retained by the underlying service. Do not submit personal or sensitive information through
          the Ask function.
        </p>

        <h2>Analytics</h2>
        <p>
          This site does not use any analytics, tracking scripts, or cookies. No data about your
          visit, device, or browsing behaviour is collected or stored.
        </p>

        <h2>Third-Party Services</h2>
        <p>
          The site is hosted on Firebase Hosting. Match and tipping data is sourced from the{" "}
          <a href="https://squiggle.com.au/" target="_blank" rel="noopener noreferrer">
            Squiggle
          </a>{" "}
          API. These services operate under their own privacy policies.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy can be directed via{" "}
          <a href="https://x.com/waynealytics" target="_blank" rel="noopener noreferrer">
            @waynealytics
          </a>{" "}
          on X.
        </p>
      </article>
    </div>
  );
}
