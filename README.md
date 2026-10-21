# GPA Calculator MCP

[![npm](https://img.shields.io/npm/v/gpa-calculator-mcp.svg)](https://www.npmjs.com/package/gpa-calculator-mcp)
[![downloads](https://img.shields.io/npm/dm/gpa-calculator-mcp.svg)](https://www.npmjs.com/package/gpa-calculator-mcp)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

GPA Calculator MCP is a free, open source [MCP](https://modelcontextprotocol.io) server, published on npm as `gpa-calculator-mcp`. It is the gpa calculator mcp for AI apps. Ask it to work out your GPA, plan the GPA you need to hit a target, convert grades between letters and percentages, and figure out what you need on the final. The math is done by tested code, not guessed by the model.

Use it with Claude, ChatGPT, Cursor, VS Code Copilot and any other app that supports MCP. It runs on your computer, needs no internet and no login, and never sees your school account.

Free forever. No account and no subscription.

## Install

Run it straight from npm with `npx`. You need Node.js 20 or newer, see [Node version](#node-version) for the details. There is nothing else to install, no account and no config file for the server itself.

```bash
npx -y gpa-calculator-mcp
```

Add it to your AI app's MCP config so the app can start it for you. For Claude Desktop that is `claude_desktop_config.json`.

```json
{
  "mcpServers": {
    "gpa": {
      "command": "npx",
      "args": ["-y", "gpa-calculator-mcp"]
    }
  }
}
```

For Claude Code, run `claude mcp add gpa -- npx -y gpa-calculator-mcp`. Restart your AI app after the config change.

## Try these three prompts

1. What do I need on the final?

   > "My grade is 74% and the final is worth 40% of the course. What do I need on the final to finish with 80%?"

   The model calls `needed_on_final` with `current_percent` 74, `final_weight_percent` 40 and `target_percent` 80. The tool works out that the other 60% of the course is locked in, so you need 89% on the final to reach 80%.

   Ask for a letter grade instead and the cutoff comes from the scale table. With `current_percent` 85, `final_weight_percent` 40 and `target_letter` "B+" on the `us4` scale, the tool says you need 90% on the final to reach the 87% where B+ starts.

2. What is my GPA?

   > "What's my GPA if I got an A in 3 credits, a B+ in 4 credits and a C in 3 credits?"

   `calculate_gpa` returns 3.12 across 10 credits on the `us4` scale, with a per course breakdown.

3. Convert a grade

   > "Convert 78 percent to a letter grade on the Ontario college scale."

   `convert_grade` returns the letter, the percentage range it covers and the grade points, using the `ontario-college` scale.

More things you can ask:

- "My grade is 85% and the final is worth 40% of the course. What do I need on the final to finish with a B+?"
- "I have a 3.1 GPA over 60 credits. What GPA do I need next semester to reach 3.4?"
- "My course is 20% quizzes, 30% labs, 50% exam. I have 85 on quizzes and 70 on labs. What's my grade so far and what's the best I can finish with?"
- "What's my GPA on the UK classification scale if I got a 2:1, a 2:2 and a first?"
- "Show me the grade scales you have built in."

## Tools

Six tools. These names are the ones your AI app sees.

| Tool | Parameters | What it does |
| --- | --- | --- |
| `calculate_gpa` | `courses` (name, credits, grade), `scale`, `prior_gpa`, `prior_credits` | Calculate a GPA for a list of courses with credits and grades, optionally combined with your earlier GPA and credits for a cumulative GPA |
| `convert_grade` | `grade`, `scale` | Convert a letter or percentage to the matching letter, percentage range and grade points |
| `needed_on_final` | `current_percent`, `final_weight_percent`, `target_percent`, `target_letter`, `scale` | Calculate the score you need on the final to hit a target, and say when it is already locked in or out of reach. Give the target as a percent or as a letter such as `B+` or `2:1`, and the cutoff comes from the scale table |
| `weighted_grade` | `parts` (name, weight, score) | Combine weighted parts into your grade so far and your worst and best possible finish; leave `score` out for unmarked work. Every weight is a percentage of the whole course, so parts you do not list still count as work to come |
| `target_gpa_planner` | `current_gpa`, `credits_completed`, `target_gpa`, `upcoming_credits`, `scale` | Plan the GPA you need on upcoming credits to reach a target cumulative GPA |
| `list_scales` | none | List the grade scales built in, with their letter, percentage and points tables |

Every tool description sent to your AI app ends with one example prompt, so the model can match a question like "What do I need on the final?" to the right tool and fill in every parameter.

## Grade scales

| Scale id | Description |
| --- | --- |
| `us4` | Common US 4.0 scale with plus and minus grades, A is 4.0 and A- is 3.7 |
| `us4plus` | Same as `us4` but A+ is 4.3 |
| `ontario-college` | A common Ontario college 4.0 scale, A+ and A are 4.0, B+ is 3.5. Check your own school's table |
| `uk-classification` | UK degree classification boundaries, a first, a 2:1, a 2:2 and a third. Check your own school's table |
| `australia-hd` | Australian 7.0 scale, HD is 7, D is 6, C is 5 and P is 4. Check your own school's table |
| `weighted-5.0` | US weighted 5.0 scale, the `us4` cutoffs with every letter above F one point higher, so A is 5.0. Check your own school's table |

Schools differ. Run `list_scales` to see the exact table used, and tell your AI if your school's cutoffs are different.

The two UK and Australian scales turn a class or a letter into grade points so the GPA tools can add up your work. For the UK table, a first is 4.0, a 2:1 is 3.3, a 2:2 is 2.7 and a third is 2.0. A UK degree is normally reported as a class, not a GPA, so treat those points as a way to compare and plan, not as an official number. Pass a class in a letter field as `1st`, `2:1`, `2:2` or `3rd`, or pass a percentage and the server picks the class for you. The `weighted-5.0` table is a plain mapping rather than one school's official table: it keeps the `us4` cutoffs and puts every letter above F one point higher, so an A is 5.0. Pick it when your school reports a weighted GPA on a 5.0 top.


## FAQ

Can I include my GPA from last semester?

Yes. Pass your earlier GPA as prior_gpa and your earlier credits as prior_credits to calculate_gpa, along with this term's courses. The tool folds them into a cumulative GPA. Pass both together; passing only one does nothing.

What if my school uses a 4.3 scale?

Use the us4plus scale. It is the us4 scale with A+ worth 4.3. Pass scale "us4plus" to calculate_gpa, convert_grade or target_gpa_planner. Run list_scales to see the full table.

What grade do I need to pass?

It depends on your school and program. On the built in us4 scale, D covers 60 to 66 percent and is usually the lowest passing grade, but many programs require a C or higher. Use needed_on_final to work out what you need on the final, or target_gpa_planner to plan a cumulative GPA. Check your school's handbook for the real cutoff.

Can I ask for a letter grade instead of a percentage?

Yes. Pass `target_letter` to `needed_on_final`, for example `target_letter` "B+", and the tool looks the cutoff up in the scale table. Pass `scale` "uk-classification" for a UK class such as 2:1. You can pass `target_percent` as well, and the tool works to the higher of the two.

Do my course parts have to add up to 100?

No. Every weight in weighted_grade is a percentage of the whole course, so you can pass only the parts you know. If you pass 20 percent quizzes and 30 percent labs with scores of 85 and 70, the tool says you have 38 percent of the course grade so far, you finish at 38 percent if you score 0 on everything left, and you finish at 88 percent if you score 100 on everything left. The other 50 percent of the course is still to come. Weights that add up to more than 100 are an error, because a course is graded out of 100.


## Use it with Brightspace or Canvas MCP

If you already pull grades from your learning system, you can combine them with this calculator. Brightspace MCP and Canvas MCP can fetch your grades from your course sites. Then you can ask this server to work out your GPA or figure out what you need on the final.

- Pull your grades with Brightspace MCP, then call `calculate_gpa` or `needed_on_final` on the numbers it gives you.
- Pull your grades with Canvas MCP, then call `calculate_gpa` or `needed_on_final` on the numbers it gives you.

Both are free and open source. See the list below for links.


## Node version

There are two floors here, and they are not the same number.

| What you are doing | Node.js |
| --- | --- |
| Running the published server | 20 or newer |
| Building and testing a clone | 22.12 or newer, on the 22 and 24 release lines or 26 and later |

The server itself is happy on Node.js 20, and that is what `engines` in package.json says. The test runner wants a newer Node.js, so the development floor lives in `devEngines` in the same file. npm checks `devEngines` before install, run and test, so a clone on Node.js 20 stops with a clear message instead of a strange failure part way through the test suite. The 23 and 25 release lines are left out on purpose, because the test runner does not run on them.

Both numbers live in package.json, and a test in `tests/node-version.test.ts` keeps them in step with the README and with the range the test runner asks for.

## Development

```bash
npm install
npm run build
npm test
```

The tests call every tool through a real MCP client, so they need no account or network. They need the newer Node.js from the Node version section above, because of the test runner.

## More free student MCP servers

All free, open source and read only where they touch your accounts. Browse the full list at [brightspacemcp.com/more-mcps](https://brightspacemcp.com/more-mcps/).

| Server | What it does |
| --- | --- |
| [Brightspace MCP](https://github.com/AnonymousOnyx22/brightspace-d2l-mcp) | D2L Brightspace for AI. Due dates with real submission status, grades, a target grade calculator and course files. |
| [Canvas MCP](https://github.com/AnonymousOnyx22/canvas-lms-student-mcp) | Read-only Canvas LMS for AI. Due dates, missing work, grades and announcements. |
| [Moodle MCP](https://github.com/AnonymousOnyx22/moodle-student-mcp) | Read-only Moodle for AI. Due dates, overdue work, grades and announcements. |
| [Google Classroom MCP](https://github.com/AnonymousOnyx22/google-classroom-student-mcp) | Read-only Google Classroom for AI. To-do, due dates, missing work and grades. |
| [Citations MCP](https://github.com/AnonymousOnyx22/student-citations-mcp) | APA, MLA and Chicago citations from a DOI, an ISBN or typed details. No account. |
| [Study Planner MCP](https://github.com/AnonymousOnyx22/study-planner-mcp) | Exam study schedules, spaced repetition dates, pomodoro plans and assignment milestones. Works offline. |
| [Paper Finder MCP](https://github.com/AnonymousOnyx22/paper-finder-student-mcp) | Search scholarly papers, find open access copies and related work through OpenAlex. No key needed. |

## License

MIT
