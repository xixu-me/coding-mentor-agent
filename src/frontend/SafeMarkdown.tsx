import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components, type ExtraProps, type UrlTransform } from "react-markdown";
import rehypeSanitize, { defaultSchema, type Options as RehypeSanitizeOptions } from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";

type SafeMarkdownProps = {
  text: string;
  variant?: "message" | "prompt";
  className?: string;
  onLineClick?: (lineNumber: number) => void;
};

const LineClickContext = createContext<((lineNumber: number) => void) | null>(null);

const LINE_REFERENCE_PATTERN = /第\s*(\d+)\s*行/g;
const SKIP_LINE_REFERENCE_ELEMENTS = new Set(["a", "code", "pre"]);
const ALLOWED_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

const ALLOWED_MARKDOWN_ELEMENTS = [
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "input",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
] as const;

const PROMPT_REMARK_PLUGINS: PluggableList = [remarkGfm];
const MESSAGE_REMARK_PLUGINS: PluggableList = [remarkGfm, remarkBreaks];

const SAFE_MARKDOWN_SCHEMA: RehypeSanitizeOptions = {
  ...defaultSchema,
  tagNames: [...ALLOWED_MARKDOWN_ELEMENTS],
  attributes: {
    ...defaultSchema.attributes,
    a: ["href", "title"],
    code: [["className", /^language-[A-Za-z0-9_-]+$/]],
    input: ["type", "checked", "disabled"],
    td: ["align"],
    th: ["align"],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
  },
};

const REHYPE_PLUGINS: PluggableList = [[rehypeSanitize, SAFE_MARKDOWN_SCHEMA]];

const MARKDOWN_COMPONENTS: Components = {
  a: MarkdownLink,
  blockquote: MarkdownBlockquote,
  input: MarkdownInput,
  li: MarkdownListItem,
  p: MarkdownParagraph,
  td: MarkdownTableCell,
  th: MarkdownTableHeader,
};

export function SafeMarkdown({ text, variant = "message", className, onLineClick }: SafeMarkdownProps) {
  const classes = ["markdown-content", `markdown-${variant}`, className].filter(Boolean).join(" ");
  const remarkPlugins = variant === "message" ? MESSAGE_REMARK_PLUGINS : PROMPT_REMARK_PLUGINS;
  return (
    <LineClickContext.Provider value={onLineClick ?? null}>
      <div className={classes}>
        <ReactMarkdown
          allowedElements={ALLOWED_MARKDOWN_ELEMENTS}
          components={MARKDOWN_COMPONENTS}
          rehypePlugins={REHYPE_PLUGINS}
          remarkPlugins={remarkPlugins}
          skipHtml
          urlTransform={safeUrlTransform}
        >
          {text}
        </ReactMarkdown>
      </div>
    </LineClickContext.Provider>
  );
}

const safeUrlTransform: UrlTransform = (url) => {
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("#")) {
    return trimmed.startsWith("#user-content-") ? trimmed : undefined;
  }
  try {
    const parsed = new URL(trimmed);
    return ALLOWED_URL_PROTOCOLS.has(parsed.protocol) ? trimmed : undefined;
  } catch {
    return undefined;
  }
};

function MarkdownParagraph({ node: _node, children, ...props }: ComponentPropsWithoutRef<"p"> & ExtraProps) {
  const onLineClick = useContext(LineClickContext);
  return <p {...props}>{enhanceLineReferences(children, onLineClick, "p")}</p>;
}

function MarkdownListItem({ node: _node, children, ...props }: ComponentPropsWithoutRef<"li"> & ExtraProps) {
  const onLineClick = useContext(LineClickContext);
  return <li {...props}>{enhanceLineReferences(children, onLineClick, "li")}</li>;
}

function MarkdownBlockquote({ node: _node, children, ...props }: ComponentPropsWithoutRef<"blockquote"> & ExtraProps) {
  const onLineClick = useContext(LineClickContext);
  return <blockquote {...props}>{enhanceLineReferences(children, onLineClick, "blockquote")}</blockquote>;
}

function MarkdownTableCell({ node: _node, children, ...props }: ComponentPropsWithoutRef<"td"> & ExtraProps) {
  const onLineClick = useContext(LineClickContext);
  return <td {...props}>{enhanceLineReferences(children, onLineClick, "td")}</td>;
}

function MarkdownTableHeader({ node: _node, children, ...props }: ComponentPropsWithoutRef<"th"> & ExtraProps) {
  const onLineClick = useContext(LineClickContext);
  return <th {...props}>{enhanceLineReferences(children, onLineClick, "th")}</th>;
}

function MarkdownLink({ node: _node, href, title, children }: ComponentPropsWithoutRef<"a"> & ExtraProps) {
  const isExternal = href ? /^https?:/i.test(href) : false;
  return (
    <a href={href} rel={isExternal ? "noreferrer noopener" : undefined} target={isExternal ? "_blank" : undefined} title={title}>
      {children}
    </a>
  );
}

function MarkdownInput({ node: _node, checked }: ComponentPropsWithoutRef<"input"> & ExtraProps) {
  return <input checked={Boolean(checked)} disabled readOnly type="checkbox" />;
}

function enhanceLineReferences(
  children: ReactNode,
  onLineClick: ((lineNumber: number) => void) | null,
  keyPrefix: string,
): ReactNode {
  if (!onLineClick) return children;
  return Children.map(children, (child, index) => enhanceNode(child, onLineClick, `${keyPrefix}-${index}`));
}

function enhanceNode(
  child: ReactNode,
  onLineClick: (lineNumber: number) => void,
  keyPrefix: string,
): ReactNode {
  if (typeof child === "string") {
    return splitLineReferenceText(child, onLineClick, keyPrefix);
  }
  if (!isValidElement(child)) {
    return child;
  }
  if (typeof child.type === "string" && SKIP_LINE_REFERENCE_ELEMENTS.has(child.type)) {
    return child;
  }
  const element = child as ReactElement<{ children?: ReactNode }>;
  if (!element.props.children) {
    return child;
  }
  return cloneElement(
    element,
    undefined,
    Children.map(element.props.children, (nestedChild, index) => enhanceNode(nestedChild, onLineClick, `${keyPrefix}-${index}`)),
  );
}

function splitLineReferenceText(
  text: string,
  onLineClick: (lineNumber: number) => void,
  keyPrefix: string,
): ReactNode {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let segmentIndex = 0;
  for (const match of text.matchAll(LINE_REFERENCE_PATTERN)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      nodes.push(text.slice(lastIndex, matchIndex));
    }
    const lineNumber = Number(match[1]);
    nodes.push(
      <button
        key={`${keyPrefix}-line-${segmentIndex}`}
        className="line-link"
        onClick={() => onLineClick(lineNumber)}
        type="button"
      >
        第 {lineNumber} 行
      </button>,
    );
    lastIndex = matchIndex + match[0].length;
    segmentIndex += 1;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes.length > 0 ? nodes : text;
}
