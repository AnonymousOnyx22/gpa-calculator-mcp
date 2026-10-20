# Changelog

## Unreleased

- Rewrote the npm description and reordered the keywords around the phrase "gpa calculator mcp", and matched the description in server.json, glama.json and llms.txt. Added a test that keeps the phrase in place and keeps the server.json description inside the registry limit. No code changes.
- Rewrote every tool description to name its concrete inputs and end with one example prompt, and gave every parameter its own description. Tool names and parameters are unchanged. Added tests that check this stays true.

## 0.1.0

- First release. Offline GPA, grade conversion, final exam and target GPA tools, with tests.
