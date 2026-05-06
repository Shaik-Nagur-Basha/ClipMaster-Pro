import React from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { IconCopy, IconCheck } from "./Icons";
import type { ReactNode } from "react";

interface FormattedContentProps {
  content: string;
  displayMode: "preview" | "full";
  highlight?: string;
  className?: string;
}

const FormattedContent: React.FC<FormattedContentProps> = ({
  content,
  displayMode,
  highlight = "",
  className = "",
}) => {
  // Helper to highlight search terms in text
  const highlightText = (text: string, term: string) => {
    if (!term || !term.trim()) return text;

    try {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(${escapedTerm})`, "gi");
      const parts = text.split(regex);

      return parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase() ? (
          <mark
            key={i}
            className="bg-rose-500/30 text-rose-100 rounded-md px-1 font-bold shadow-[0_0_15px_rgba(244,63,94,0.3)] border border-rose-500/20"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      );
    } catch (e) {
      return text;
    }
  };

  // Helper to recursively process children and highlight text nodes
  const renderHighlightedChildren = (children: any, term: string): any => {
    if (!term) return children;
    return React.Children.map(children, (child) => {
      if (typeof child === "string") {
        return highlightText(child, term);
      }
      if (React.isValidElement(child) && (child.props as any).children) {
        return React.cloneElement(child as any, {
          children: renderHighlightedChildren((child.props as any).children, term),
        });
      }
      return child;
    });
  };

  // Internal CodeBlock component for copy functionality and premium minimalist styling
  const CodeBlock = ({ language, value }: { language: string; value: string }) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy!", err);
      }
    };

    return (
      <div className="group relative my-3 rounded-lg border border-white/10 bg-[#0d1117]/40 overflow-hidden transition-all hover:border-white/20">
        {/* Floating Copy Button - Compact & Simple */}
        <button
          onClick={handleCopy}
          className={`absolute top-2 right-2 z-10 p-1.5 rounded-md transition-all duration-200 opacity-0 group-hover:opacity-100 border ${
            copied
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/10"
          }`}
          title="Copy Code"
        >
          {copied ? (
            <IconCheck size={12} strokeWidth={3} />
          ) : (
            <IconCopy size={12} strokeWidth={2} />
          )}
        </button>

        <SyntaxHighlighter
          language={language}
          style={atomDark}
          PreTag="div"
          className="!m-0 !bg-transparent text-[12.5px] font-mono leading-relaxed scrollbar-thin max-h-[450px] overflow-auto"
          customStyle={{
            background: "transparent",
            padding: "1rem",
            margin: 0,
          }}
          codeTagProps={{
            style: {
              background: "transparent",
              fontFamily: "inherit",
            },
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    );
  };

  // Check if content looks like Markdown (has markdown-like patterns)
  const isMarkdown =
    /#+\s|\*{1,3}|\-\s|\d+\.|\`{1,3}|\[.+\]\(|>|\|/.test(content);

  if (!isMarkdown) {
    // For non-markdown plain text, use whitespace-pre-wrap
    return (
      <div
        className={`text-[13px] leading-relaxed break-words whitespace-pre-wrap ${
          displayMode === "preview" ? "line-clamp-3" : ""
        } ${className}`}
      >
        {highlight ? highlightText(content, highlight) : content}
      </div>
    );
  }

  // For markdown content, render with formatting
  const components: any = {
    code: (props: any) => {
      const { className, children } = props;
      const match = /language-(\w+)/.exec(className || "");
      const lang = match ? match[1] : "text";

      // react-markdown v9+ does not pass 'inline'. 
      // We detect inline code by the absence of a language class and no newlines.
      const isInline = !match && !String(children).includes("\n");

      if (isInline) {
        return (
          <code className="bg-[#2d2d3d] text-gray-100 px-1.5 py-0.5 rounded-md text-[12px] font-mono border border-white/10 mx-0.5 inline align-baseline">
            {renderHighlightedChildren(children, highlight)}
          </code>
        );
      }

      return (
        <CodeBlock language={lang} value={String(children).replace(/\n$/, "")} />
      );
    },
    pre: ({ children }: any) => (
      <div className="my-2 rounded-lg overflow-auto">{children}</div>
    ),
    a: ({ href, children }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-400 hover:text-brand-300 underline"
      >
        {renderHighlightedChildren(children, highlight)}
      </a>
    ),
    h1: ({ children }: any) => (
      <h1 className="text-lg font-bold text-gray-100 mt-2 mb-1">
        {renderHighlightedChildren(children, highlight)}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-base font-bold text-gray-100 mt-2 mb-1">
        {renderHighlightedChildren(children, highlight)}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-sm font-semibold text-gray-100 mt-1.5 mb-0.5">
        {renderHighlightedChildren(children, highlight)}
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
    li: ({ children }: any) => (
      <li className="text-gray-300">
        {renderHighlightedChildren(children, highlight)}
      </li>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-2 border-brand-500 pl-3 ml-0 italic text-gray-400 text-[13px] my-1">
        {renderHighlightedChildren(children, highlight)}
      </blockquote>
    ),
    p: ({ children }: any) => (
      <p className="text-gray-300 my-1">
        {renderHighlightedChildren(children, highlight)}
      </p>
    ),
    strong: ({ children }: any) => (
      <strong className="text-brand-300 font-semibold">
        {renderHighlightedChildren(children, highlight)}
      </strong>
    ),
    em: ({ children }: any) => (
      <em className="text-brand-200 italic">
        {renderHighlightedChildren(children, highlight)}
      </em>
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
