# Changelog

## Unreleased

- Updated the development dependencies to the current releases: TypeScript 7.0.2, Vitest 5.0.5 and the Node type definitions 26.6.5. TypeScript 7 does not pick up the packages in node_modules/@types on its own, so tsconfig.json now names the node types. package-lock.json was regenerated to match. The server code and the tool list did not change.
- Added a test that keeps package-lock.json in step with package.json and keeps the node types in tsconfig.json.
- Listed all six tools with their parameters and one example call in llms.txt, and added the same tool list with parameters, examples and the three grade conversion tables to glama.json. Both files now carry the offline, no account claim word for word. Added a test that keeps the two files in step with the code.
- Rewrote the npm description and reordered the keywords around the phrase "gpa calculator mcp", and matched the description in server.json, glama.json and llms.txt. Added a test that keeps the phrase in place and keeps the server.json description inside the registry limit. No code changes.
- Rewrote every tool description to name its concrete inputs and end with one example prompt, and gave every parameter its own description. Tool names and parameters are unchanged. Added tests that check this stays true.

## 0.1.0

- First release. Offline GPA, grade conversion, final exam and target GPA tools, with tests.
