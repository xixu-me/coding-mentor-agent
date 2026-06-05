# Security Policy

## Reporting Vulnerabilities

Please report suspected vulnerabilities privately to the repository owner before
public disclosure. Include:

- affected file or feature
- reproduction steps
- expected impact
- any relevant logs with secrets removed

Do not include real API keys, tokens, passwords, private keys, cookies, or other
credentials in reports.

## Secret Handling

Never commit `.env`, `.env.local`, credentials, private keys, provider tokens, or
local database files. Use `.env.example` for placeholders only.

If a secret is committed or pushed:

1. Revoke or rotate the credential immediately.
2. Remove it from the repository.
3. Rewrite affected history.
4. Force-push the cleaned branch only after rescanning.

## Deployment Warning

This project is designed for local development. The Docker Compose sandbox
mounts `/var/run/docker.sock`; do not deploy that configuration publicly without
a hardened sandbox architecture.

