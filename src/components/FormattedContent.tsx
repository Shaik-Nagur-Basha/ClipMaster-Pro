import React from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ReactNode } from "react";

interface FormattedContentProps {
  content: string;
  displayMode: "preview" | "full";
  className?: string;
}

const FormattedContent: React.FC<FormattedContentProps> = ({
  content,
  displayMode,
  className = "",
}) => {
  // Check if content looks like Markdown (has markdown-like patterns)
  const isMarkdown = /^#+\s|^\*{1,3}|^\-\s|^\d+\.|^\`{1,3}|^\[.+\]\(|^>|^\|/m.test(
    content,
  );

  if (!isMarkdown) {
    // For non-markdown plain text, use whitespace-pre-wrap
    return (
      <div
        className={`text-[13px] leading-relaxed break-words whitespace-pre-wrap ${
          displayMode === "preview" ? "line-clamp-3" : ""
        } ${className}`}
      >
        {content}
      </div>
    );
  }

  // For markdown content, render with formatting
  const components: any = {
    code: ({ inline, className: codeClassName, children }: any) => {
      const match = (codeClassName || "").match(/language-(\w+)/);
      const lang = match ? match[1] : "text";

      if (inline) {
        return (
          <code className="bg-surface-800/70 text-brand-300 px-1.5 py-0.5 rounded text-[12px] font-mono">
            {children}
          </code>
        );
      }

      return (
        <SyntaxHighlighter
          language={lang}
          style={oneDark}
          className="rounded-lg text-[12px] font-mono my-1 max-h-[300px] overflow-auto"
          customStyle={{
            backgroundColor: "#0f1419",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #2d3139",
          }}
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      );
    },
    a: ({ href, children }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-400 hover:text-brand-300 underline"
      >
        {children}
      </a>
    ),
    h1: ({ children }: any) => (
      <h1 className="text-lg font-bold text-gray-100 mt-2 mb-1">{children}</h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-base font-bold text-gray-100 mt-2 mb-1">
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-sm font-semibold text-gray-100 mt-1.5 mb-0.5">
        {children}
      </h3>
    ),
    ul: ({ children }: any) => (
      <ul className="list-disc list-inside my-1 ml-2 text-gray-300 text-[13px]">
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal list-inside my-1 ml-2 text-gray-300 text-[13px]">
        {children}
      </ol>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-2 border-brand-500 pl-3 ml-0 italic text-gray-400 text-[13px] my-1">
        {children}
      </blockquote>
    ),
    p: ({ children }: any) => (
      <p className="text-gray-300 my-1">{children}</p>
    ),
    strong: ({ children }: any) => (
      <strong className="text-brand-300 font-semibold">{children}</strong>
    ),
    em: ({ children }: any) => (
      <em className="text-brand-200 italic">{children}</em>
    ),
  };

  return (
    <div
      className={`text-[13px] leading-relaxed ${
        displayMode === "preview" ? "line-clamp-3" : ""
      } ${className}`}
    >
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
};

export default FormattedContent;
