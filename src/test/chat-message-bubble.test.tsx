import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatMessageBubble } from "@/components/chat/ChatMessageBubble";
import type { ChatMessage } from "@/lib/genie-types";

describe("ChatMessageBubble", () => {
  it("renders assistant text as markdown and hides SQL", () => {
    const message: ChatMessage = {
      id: "assistant-1",
      role: "assistant",
      text: "The most recent result is from **September 27, 2025**.",
      status: "COMPLETED",
      query: "SELECT * FROM matches ORDER BY date DESC LIMIT 1",
    };

    const html = renderToStaticMarkup(<ChatMessageBubble message={message} />);

    expect(html).toContain("<strong>September 27, 2025</strong>");
    expect(html).not.toContain("SELECT * FROM matches");
    expect(html).not.toContain("<pre");
  });

  it("preserves newline-separated assistant prose", () => {
    const message: ChatMessage = {
      id: "assistant-2",
      role: "assistant",
      text: "Line one\nLine two",
      status: "COMPLETED",
    };

    const html = renderToStaticMarkup(<ChatMessageBubble message={message} />);

    expect(html).toContain("Line one<br/>");
    expect(html).toContain("Line two");
  });

  it("renders user text literally without markdown formatting", () => {
    const message: ChatMessage = {
      id: "user-1",
      role: "user",
      text: "Please keep **this** literal.",
      status: "COMPLETED",
    };

    const html = renderToStaticMarkup(<ChatMessageBubble message={message} />);

    expect(html).toContain("Please keep **this** literal.");
    expect(html).not.toContain("<strong>this</strong>");
  });
});
