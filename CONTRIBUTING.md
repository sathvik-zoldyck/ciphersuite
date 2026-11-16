# Contributing to CipherSuite

Thanks for helping. Bug reports, findings-library writeups, parser fixes and UI improvements are all welcome.

## Run it locally

```bash
git clone https://github.com/sathvik-zoldyck/ciphersuite.git
cd ciphersuite
npm install
npm run dev          # http://localhost:3000, guest mode works with no setup
```

Accounts and sync need a Firebase project, and the AI features need a Gemini API key. See [Configuration](README.md#configuration) in the README.

## Before you open a pull request

```bash
npm run typecheck
npm test
npm run build
```

CI runs the same three commands on every pull request.

## Good first contributions

- **Add a writeup to the findings library.** Append an entry to `src/lib/finding-library.ts`. Keep it generic (no client names or hosts) and give a CVSS score; severity is derived from it.
- **Improve a tool parser.** Nmap, Nessus and Burp parsing lives in `src/lib/parsers/parse-tool-output.ts`. Sample files that break it are useful bug reports.
- **Add tests.** Tests live next to the code in `src/lib/__tests__/` and use Node's built-in test runner.

## Guidelines

- One change per pull request, with a short description of what changed and why.
- Match the existing style; run `npm run typecheck` before pushing.
- Never commit real findings, client data, API keys or `.env.local`.
- For security issues, follow [SECURITY.md](SECURITY.md) instead of opening an issue.

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
