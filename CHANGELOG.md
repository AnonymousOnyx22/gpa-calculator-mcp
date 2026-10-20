# Changelog

## 0.1.1

- Audit llms.txt and glama.json so every tool appears with parameters and 
- Run npm outdated, bump dependencies and confirm the test suite passes be
- Not in npm top 40 for "gpa calculator mcp"
- Add a test asserting package.json, server.json and the registry all read 0.1.0
- Rename tools and rewrite descriptions with concrete inputs and one example prompt each
- Rebuild the README first screen as an install block plus three example prompts
- Rank for 'gpa calculator mcp' by rewriting package.json description and keywords
- Shorten the server.json description to 100 characters (it is 132)
- keywords, search-rank, listing

## Unreleased

- Updated the development dependencies to the current releases: TypeScript 7.0.2, Vitest 5.0.5 and the Node type definitions 26.6.5. TypeScript 7 does not pick up the packages in node_modules/@types on its own, so tsconfig.json now names the node types. package-lock.json was regenerated to match. The server code and the tool list did not change.
- Added a test that keeps package-lock.json in step with package.json and keeps the node types in tsconfig.json.
- Listed all six tools with their parameters and one example call in llms.txt, and added the same tool list with parameters, examples and the three grade conversion tables to glama.json. Both files now carry the offline, no account claim word for word. Added a test that keeps the two files in step with the code.
- Rewrote the npm description and reordered the keywords around the phrase "gpa calculator mcp", and matched the description in server.json, glama.json and llms.txt. Added a test that keeps the phrase in place and keeps the server.json description inside the registry limit. No code changes.
- Rewrote every tool description to name its concrete inputs and end with one example prompt, and gave every parameter its own description. Tool names and parameters are unchanged. Added tests that check this stays true.

## 0.1.0

- First release. Offline GPA, grade conversion, final exam and target GPA tools, with tests.
