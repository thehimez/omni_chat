import { useRef, useState, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const QUOTE_PATTERNS = [
  '<div class="gmail_quote"',
  '<blockquote class="gmail_quote"',
  '<div id="divRplyFwdMsg"',
  '<div id="appendonsend"',
  '<hr id="stopSpelling"',
  '<div class="yahoo_quoted"',
];

function splitAtQuote(html: string): { main: string; quoted: string | null } {
  for (const pattern of QUOTE_PATTERNS) {
    const idx = html.indexOf(pattern);
    if (idx > 80) {
      return { main: html.slice(0, idx), quoted: html.slice(idx) };
    }
  }
  return { main: html, quoted: null };
}

function wrapHtml(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
*{box-sizing:border-box}
body{margin:0;padding:4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#374151;word-break:break-word}
img{max-width:100%;height:auto}
a{color:#6366f1;text-decoration:underline}
blockquote{border-left:3px solid #e5e7eb;margin:8px 0;padding:4px 12px;color:#6b7280}
table{max-width:100%!important;border-collapse:collapse}
td,th{word-break:break-word}
pre{white-space:pre-wrap;font-family:inherit;margin:0}
p{margin:0 0 8px}
h1,h2,h3,h4{margin:12px 0 6px;font-weight:600}
ul,ol{margin:4px 0;padding-left:20px}
</style></head><body>${content}</body></html>`;
}

interface HtmlRendererProps {
  html?: string | null;
  text: string;
}

export function HtmlRenderer({ html, text }: HtmlRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(100);
  const [showQuoted, setShowQuoted] = useState(false);

  const hasHtml = !!html && html.trim().length > 10;
  const { main, quoted } = hasHtml ? splitAtQuote(html!) : { main: null, quoted: null };

  const srcDoc = hasHtml ? wrapHtml(showQuoted ? html! : main!) : null;

  const measureHeight = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc?.body) {
        const h = doc.body.scrollHeight;
        if (h > 0) setHeight(Math.min(h + 20, 2400));
      }
    } catch {
      /* sandboxed — ignore */
    }
  }, []);

  if (!hasHtml) {
    return (
      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
        {text || "(No content)"}
      </div>
    );
  }

  return (
    <div>
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc!}
        sandbox="allow-same-origin allow-popups"
        onLoad={measureHeight}
        style={{ height, border: "none", width: "100%", display: "block" }}
        title="email-body"
      />
      {quoted && (
        <button
          onClick={() => {
            setShowQuoted((v) => !v);
            setTimeout(measureHeight, 120);
          }}
          className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-indigo-500 mt-1 transition-colors"
        >
          {showQuoted ? (
            <><ChevronUp className="w-3 h-3" />Hide previous messages</>
          ) : (
            <><ChevronDown className="w-3 h-3" />Show previous messages</>
          )}
        </button>
      )}
    </div>
  );
}
