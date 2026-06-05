const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\b(sk-|api[_-]?key|bearer|token|secret|password)\s*[:=]\s*[A-Za-z0-9._\-+/=]{12,}/gi, "$1=[redacted-secret]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[redacted-secret]"],
  [/-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, "[redacted-secret]"],
  [/[A-Za-z]:[\\/][^\s"'<>]+/g, "[redacted-path]"],
  [/\/(?:tmp|var|home|Users|workspaces|github)\/[^\s"'<>]+/g, "[redacted-path]"],
];

const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+instructions/gi,
  /忽略(以上|之前|所有)规则/g,
  /泄露(系统|隐藏|密钥|prompt)/g,
  /<!--[\s\S]*?-->/g,
  /[\u200b-\u200f\u2028-\u202f\u2060-\u206f]/g,
];

export function redactText(input: unknown, maxLength = 4000): string {
  let text = typeof input === "string" ? input : JSON.stringify(input);
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  if (text.length > maxLength) {
    return `${text.slice(0, maxLength)}\n[truncated]`;
  }
  return text;
}

export function sanitizeExternalContent(input: string, maxLength = 20000): string {
  let text = input;
  for (const pattern of INJECTION_PATTERNS) {
    text = text.replace(pattern, "");
  }
  return redactText(text, maxLength);
}

export function summarizeText(input: string, maxLength = 500): string {
  const oneLine = redactText(input, maxLength).replace(/\s+/g, " ").trim();
  return oneLine.length > maxLength ? `${oneLine.slice(0, maxLength)}...` : oneLine;
}

export function safeJson(value: unknown): string {
  return redactText(value, 8000);
}
