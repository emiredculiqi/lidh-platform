"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders assistant message markdown so **bold**, lists and links display
// properly instead of as literal symbols. Matches the lidh.al marketing
// site's AssistantMarkdown so web + demo + dashboard read consistently.
export function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => {
          const ext = href?.startsWith("http");
          return (
            <a
              href={href}
              target={ext ? "_blank" : undefined}
              rel={ext ? "noopener noreferrer" : undefined}
              className="font-medium underline underline-offset-2"
            >
              {children}
            </a>
          );
        },
        p: ({ children }) => (
          <p className="mb-2 whitespace-pre-wrap last:mb-0">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => <li className="mb-0.5">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => (
          <code className="rounded bg-black/5 px-1 py-0.5 text-[0.85em]">
            {children}
          </code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
