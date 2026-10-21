# Changelog

## 0.1.3

- Add Brightspace and Canvas MCP usage section to README

## 0.1.2

- Small fixes and clearer docs

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

- Added install configs for ChatGPT, Cursor and VS Code Copilot to the README. The install section now has a part for each app with the config file that app reads, so people who look for this server by cursor mcp, copilot mcp or chatgpt mcp find the steps they need. The tools, the parameters and the numbers the tools return are unchanged.
- calculate_gpa now stops with an error when only one of prior_gpa and prior_credits is passed. Before this the half request was quietly dropped, so the student got a term GPA with no sign that the earlier terms were left out. The error says which of the two is missing. The tool names, the parameters and the numbers the tools return are unchanged, and passing both still gives the cumulative GPA.
- Added the search terms students actually type to the keywords in package.json: cgpa, cgpa calculator, sgpa, sgpa calculator, target grade and target grade calculator. The list before this had 34 keywords and none of them covered a cumulative GPA, a semester GPA or a target grade calculator, so a search for those words found nothing. The npm description now names CGPA, SGPA and the target grade as well, and the server.json description was rewritten to fit inside the 100 character registry limit.
- The calculate_gpa tool description now says which number is the term GPA and which is the cumulative GPA, so a question about a CGPA or an SGPA lands on the right tool. The tool names, the parameters and the numbers the tools return are unchanged.
- Added a test that keeps cgpa, sgpa and target grade calculator in the keywords, so the search terms cannot quietly disappear. No code changes to the math.

- The `needed_on_final` tool now takes a target letter grade. Pass `target_letter` with something like "B+" or "2:1" and the tool looks the cutoff up in the scale table, so it can tell you what you need on the final for a grade instead of a number. The tool also takes a `scale` id, which says which table the cutoff comes from. `target_percent` is still there and still works on its own, and if you pass both the tool works to the higher of the two. The tool names and the other parameters are unchanged.
- Fixed the weighted_grade tool, which used to rescale the weights you pass in. A weight is a percentage of the whole course, so the course total of 100 percent is used and the parts are never rescaled. Passing only the parts you know, for example 20 percent quizzes and 30 percent labs, now reports a worst finish of 38 percent instead of 76 percent. The grade so far is the points you have out of 100, and the average on the marked work is reported next to it. Weights that add up to more than 100 percent are now an error. The tool names and parameters are unchanged.
- Pinned the node version numbers in one place. package.json keeps `engines` at node 20 or newer for people who install the server, and now also has a `devEngines` block that asks for the node range the test runner wants, which is node 22.12 or newer on the 22 and 24 release lines or 26 and later. The README has a new Node version section that gives both floors in a table, and a new test file checks that package.json, the README and the installed test runner still agree. No code changes and no dependency changes.
- Ran npm outdated before finishing. Every dependency was already on its latest release, so nothing was bumped and package-lock.json stayed as it was.
- Added three more grade scales: `uk-classification` for UK degree classes (a first, a 2:1, a 2:2 and a third, with a plain mapping to grade points), `australia-hd` for the common Australian 7.0 scale (HD, D, C and P), and `weighted-5.0` for a US weighted 5.0 top (the us4 cutoffs, one point higher above F, so A is 5.0). Mirrored the new tables into llms.txt and glama.json and the README scale table, lifted the GPA bounds from 5 to 7 so the 7.0 scale fits, and matched the tables and bounds in the tests. Tool names and parameters are unchanged.
- Added a test that asks the server for its own tool list over an in memory link and checks that llms.txt and glama.json list the same tools in the same order, so a tool cannot ship undocumented.
- Updated the development dependencies to the current releases: TypeScript 7.0.2, Vitest 5.0.5 and the Node type definitions 26.6.5. TypeScript 7 does not pick up the packages in node_modules/@types on its own, so tsconfig.json now names the node types. package-lock.json was regenerated to match. The server code and the tool list did not change.
- Added a test that keeps package-lock.json in step with package.json and keeps the node types in tsconfig.json.
- Listed all six tools with their parameters and one example call in llms.txt, and added the same tool list with parameters, examples and the three grade conversion tables to glama.json. Both files now carry the offline, no account claim word for word. Added a test that keeps the two files in step with the code.
- Rewrote the npm description and reordered the keywords around the phrase "gpa calculator mcp", and matched the description in server.json, glama.json and llms.txt. Added a test that keeps the phrase in place and keeps the server.json description inside the registry limit. No code changes.
- Rewrote every tool description to name its concrete inputs and end with one example prompt, and gave every parameter its own description. Tool names and parameters are unchanged. Added tests that check this stays true.

## 0.1.0

- First release. Offline GPA, grade conversion, final exam and target GPA tools, with tests.
