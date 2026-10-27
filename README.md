# GPA Calculator MCP

[![npm](https://img.shields.io/npm/v/gpa-calculator-mcp.svg)](https://www.npmjs.com/package/gpa-calculator-mcp)
[![downloads](https://img.shields.io/npm/dm/gpa-calculator-mcp.svg)](https://www.npmjs.com/package/gpa-calculator-mcp)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Star on GitHub](https://img.shields.io/github/stars/AnonymousOnyx22/gpa-calculator-mcp.svg)](https://github.com/AnonymousOnyx22/gpa-calculator-mcp)

GPA Calculator MCP is a free, open source [MCP](https://modelcontextprotocol.io) server, published on npm as `gpa-calculator-mcp`. It is a GPA calculator for AI apps. Ask it to work out your GPA, your cumulative GPA (CGPA), your semester GPA (SGPA) or your weighted GPA with credit multipliers, plan the GPA you need to hit a target and the grade each upcoming course needs, convert grades between letters and percentages, and figure out what grade you need on the final. The math is done by tested code, not guessed by the model.

Use it with Claude, ChatGPT, Cursor, VS Code Copilot and any other app that supports MCP. It runs on your computer, needs no internet and no login, and never sees your school account.

Free forever. No account and no subscription.

## Install

Run it straight from npm with `npx`. You need Node.js 20 or newer, see [Node version](#node-version) for the details. There is nothing else to install, no account and no config file for the server itself.

```bash
npx -y gpa-calculator-mcp
```

Add it to your AI app's MCP config so the app can start it for you. Every app reads its config from its own file, so pick yours:

- [Claude Desktop](#claude-desktop)
- [Claude Code](#claude-code)
- [ChatGPT](#chatgpt)
- [Cursor](#cursor)
- [VS Code Copilot](#vs-code-copilot)

All of them start the same server the same way. The only difference is where the config goes.

### Claude Desktop

Add this to `claude_desktop_config.json`:

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

Restart Claude Desktop after you save the file.

### Claude Code

Run this in a terminal:

```bash
claude mcp add gpa -- npx -y gpa-calculator-mcp
```

### ChatGPT

The ChatGPT desktop app can start a server that runs on your computer. Open Settings, choose MCP servers, add a server, pick STDIO and give it the command `npx` with the arguments `-y gpa-calculator-mcp`. Save the server and restart the app.

The desktop app, the Codex CLI and the IDE extension read the same config file, `~/.codex/config.toml`, so you can write the server there instead:

```toml
[mcp_servers.gpa]
command = "npx"
args = ["-y", "gpa-calculator-mcp"]
```

Type `/mcp` in a chat to see the servers that are connected.

The ChatGPT website talks to servers over the web, so it needs a public HTTPS address. Put a tunnel in front of a server that runs on your computer, then add it as a custom MCP server from the Plugins page.

### Cursor

Cursor reads `mcp.json` from the project folder at `.cursor/mcp.json`, or from your home folder at `~/.cursor/mcp.json` if you want the server in every project. On Windows the home folder file is `%USERPROFILE%\.cursor\mcp.json`.

```json
{
  "mcpServers": {
    "gpa": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "gpa-calculator-mcp"]
    }
  }
}
```

Restart Cursor after you save the file. The Customize page in the sidebar lists the server once it starts, and you can turn it on or off there.

### VS Code Copilot

Put this in `.vscode/mcp.json` in your project folder, or in the `mcp.json` file in your user profile:

```json
{
  "servers": {
    "gpa": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "gpa-calculator-mcp"]
    }
  }
}
```

VS Code also reads a portable `.mcp.json` file in the project root. That file uses the name `mcpServers` instead of `servers`:

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

Restart VS Code after you save the file.

After any of these, try one of the prompts below.

## Try these three prompts

1. What do I need on the final?

   > "My grade is 85% and the final is worth 40% of the course. What do I need on the final to finish with a B+?"

   The model calls `needed_on_final` with `current_percent` 85, `final_weight_percent` 40 and `target_letter` "B+" on the `us4` scale. B+ starts at 87% on that scale, so you need 90% on the final to reach it.

   Ask for a percentage target instead and the tool does the same sum. With `current_percent` 74, `final_weight_percent` 40 and `target_percent` 80, the other 60% of the course is locked in, so you need 89% on the final to reach 80%.

2. What is my GPA?

   > "What's my GPA if I got an A in 3 credits, a B+ in 4 credits and a C in 3 credits?"

   `calculate_gpa` returns 3.12 across 10 credits on the `us4` scale, with a per course breakdown.

3. Convert a grade

   > "Convert 78 percent to a letter grade on the Ontario college scale."

   `convert_grade` returns the letter, the percentage range it covers and the grade points, using the `ontario-college` scale.

More things you can ask:

- "I have a 3.1 GPA over 60 credits. What GPA do I need next semester to reach 3.4?"
- "I have a 3.4 GPA over 60 credits. What do I need in each of my four classes next semester to reach 3.5?"
- "My course is 20% quizzes, 30% labs, 50% exam. I have 85 on quizzes and 70 on labs. What's my grade so far and what's the best I can finish with?"
- "What's my GPA on the UK classification scale if I got a 2:1, a 2:2 and a first?"
- "What's my CGPA? I had a 3.2 GPA over 45 credits and this term I got an A in 3 credits, a B+ in 4 credits and a C in 3 credits."
- "What's my weighted GPA if my two AP classes count 1.1 times the credits?"
- "Show me the grade scales you have built in."

## Tools

Seven tools. These names are the ones your AI app sees.

| Tool | Parameters | What it does | Example prompt |
| --- | --- | --- | --- |
| `calculate_gpa` | `courses` (name, credits, grade, credit_multiplier), `transcript_csv`, `scale`, `prior_gpa`, `prior_credits` | Calculate a GPA for a list of courses with credits and grades, optionally weighted with a `credit_multiplier` on each course, and optionally combined with your earlier GPA and credits for a cumulative GPA. Pass `prior_gpa` and `prior_credits` together, or leave both out. Alternatively, pass `transcript_csv` as a CSV string with columns for course name, credits, grade and optional credit multiplier; a header row is optional. When `courses` is not given, `transcript_csv` is parsed and used as the course list | "What's my GPA if I got an A in 3 credits, a B+ in 4 credits and a C in 3 credits?" |
| `convert_grade` | `grade`, `scale` | Convert a letter or percentage to the matching letter, percentage range and grade points | "Convert 78 percent to a letter grade on the Ontario college scale." |
| `needed_on_final` | `current_percent`, `final_weight_percent`, `target_percent`, `target_letter`, `scale` | Calculate the score you need on the final to hit a target, and say when it is already locked in or out of reach. Give the target as a percent or as a letter such as `B+` or `2:1`, and the cutoff comes from the scale table | "My grade is 85% and the final is worth 40% of the course. What do I need on the final to finish with a B+?" |
| `weighted_grade` | `parts` (name, weight, score) | Combine weighted parts into your grade so far and your worst and best possible finish; leave `score` out for unmarked work. Every weight is a percentage of the whole course, so parts you do not list still count as work to come | "My course is 20% quizzes, 30% labs, 50% exam. I have 85 on quizzes and 70 on labs. What's my grade so far and what's the best I can finish with?" |
| `target_gpa_planner` | `current_gpa`, `credits_completed`, `target_gpa`, `upcoming_credits`, `scale` | Plan the GPA you need on upcoming credits to reach a target cumulative GPA | "I have a 3.1 GPA over 60 credits. What GPA do I need next semester to reach 3.4?" |
| `plan_courses` | `current_gpa`, `credits_completed`, `target_gpa`, `courses` (name, credits), `scale` | Plan the GPA your upcoming courses need to reach a target cumulative GPA, and give the lowest letter in each course that keeps the plan on track | "I have a 3.4 GPA over 60 credits. What do I need in each of my four classes next semester to reach 3.5?" |
| `list_scales` | none | List the grade scales built in, with their letter, percentage and points tables | "Show me the grade scales you have built in." |

Every tool description sent to your AI app ends with one example prompt, so the model can match a question like "What do I need on the final?" to the right tool and fill in every parameter.

Every tool also returns the same numbers as structured data. Each tool has an output schema, so a client that reads JSON gets fields such as `term_gpa` or `needed_percent` straight away, and the text answer stays the same for an app that only reads words. The fields each tool returns are listed in [llms.txt](llms.txt) and in [glama.json](glama.json).

## Grade scales

| Scale id | Description |
| --- | --- |
| `us4` | Common US 4.0 scale with plus and minus grades, A is 4.0 and A- is 3.7 |
| `us4plus` | Same as `us4` but A+ is 4.3 |
| `ontario-college` | A common Ontario college 4.0 scale, A+ and A are 4.0, B+ is 3.5. Check your own school's table |
| `uk-classification` | UK degree classification boundaries, a first, a 2:1, a 2:2 and a third, where a first is worth 4.0 grade points. Check your own school's table |
| `australia-hd` | Australian 7.0 scale, HD is 7, D is 6, C is 5 and P is 4. Check your own school's table |
| `weighted-5.0` | US weighted 5.0 scale, the `us4` cutoffs with every letter above F one point higher, so A is 5.0. Check your own school's table |

The `scale` parameter takes one of these six ids. A client that reads the tool schema sees them as the allowed values, and any other value is rejected before the tool runs.

Schools differ. Run `list_scales` to see the exact table used, and tell your AI if your school's cutoffs are different.

The two UK and Australian scales turn a class or a letter into grade points so the GPA tools can add up your work. For the UK table, a first is 4.0, a 2:1 is 3.3, a 2:2 is 2.7 and a third is 2.0. A UK degree is normally reported as a class, not a GPA, so treat those points as a way to compare and plan, not as an official number. Pass a class in a letter field as `1st`, `2:1`, `2:2` or `3rd`, or pass a percentage and the server picks the class for you. The `weighted-5.0` table is a plain mapping rather than one school's official table: it keeps the `us4` cutoffs and puts every letter above F one point higher, so an A is 5.0. Pick it when your school reports a weighted GPA on a 5.0 top.


## FAQ

What is the difference between CGPA and SGPA?

SGPA is the GPA for one term, so the GPA for the courses you pass in. CGPA is the cumulative GPA over every term you have finished. calculate_gpa gives you the term GPA for the courses you pass. Add your earlier GPA and credits as prior_gpa and prior_credits and the tool also gives the cumulative GPA.

Can I include my GPA from last semester?

Yes. Pass your earlier GPA as prior_gpa and your earlier credits as prior_credits to calculate_gpa, along with this term's courses. The tool folds them into a cumulative GPA. Pass both together. Passing only one of the two is an error, so the tool says which one is missing instead of quietly leaving the earlier terms out.

Can I give an AP class more weight?

Yes. Pass `credit_multiplier` on a course in `calculate_gpa`, for example 1.1 for an AP class that counts 1.1 times the credits. The plain `term_gpa` stays the same as it was, and the answer adds a `weighted_gpa` with the multipliers applied plus the weighted credits. Schools differ, so ask which multiplier yours uses. The weighted GPA covers the courses in that call, while the cumulative GPA keeps using the plain credits.

What if my school uses a 4.3 scale?

Use the us4plus scale. It is the us4 scale with A+ worth 4.3. Pass scale "us4plus" to calculate_gpa, convert_grade or target_gpa_planner. Run list_scales to see the full table.

What grade do I need to pass?

It depends on your school and program. On the built in us4 scale, D covers 63 to 66 percent and is usually the lowest passing grade, but many programs require a C or higher. Use needed_on_final to work out what you need on the final, or target_gpa_planner to plan a cumulative GPA. Check your school's handbook for the real cutoff.

Can I ask for a letter grade instead of a percentage?

Yes. Pass `target_letter` to `needed_on_final`, for example `target_letter` "B+", and the tool looks the cutoff up in the scale table. Pass `scale` "uk-classification" for a UK class such as 2:1. You can pass `target_percent` as well, and the tool works to the higher of the two.

Do my course parts have to add up to 100?

No. Every weight in weighted_grade is a percentage of the whole course, so you can pass only the parts you know. If you pass 20 percent quizzes and 30 percent labs with scores of 85 and 70, the tool says your grade so far is 76 percent, which banks 38 of the 100 points the course is worth, you finish at 38 percent if you score 0 on everything left, and you finish at 88 percent if you score 100 on everything left. The other 50 percent of the course is still to come. Weights that add up to more than 100 are an error, because a course is graded out of 100.

Can a script read the numbers without reading the sentence?

Yes. Every tool has an output schema and returns the numbers as fields next to the text, so a script can read `term_gpa` or `needed_percent` without taking them out of the sentence. The text answer is the same as it has always been.


## How it compares

| Option | Needs login or school access | Runs offline | Focus | When to use |
| --- | --- | --- | --- | --- |
| GPA Calculator MCP (this server) | No | Yes | Just the numbers. GPA, CGPA, SGPA, weighted grades, targets and conversions. | You have numbers or want to plan and just need the calculation. |
| LMS MCP servers (like Brightspace, Canvas, Moodle, Google Classroom) | Often yes, connects to a school system | Usually no | Pulls grades, due dates and course data from a learning system. Some include a target grade calculator. | You want to pull data straight from your courses, not type numbers in. |

For a student who just wants the number, a focused offline calculator avoids signing in, avoids connecting to a school server and keeps the task to arithmetic. If you already pull grades from an LMS, you can still pass those numbers to this calculator.

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
| [Canvas MCP](https://github.com/AnonymousOnyx22/canvas-lms-student-mcp) | Canvas LMS for AI, read only. Due dates, missing work, grades and announcements. |
| [Moodle MCP](https://github.com/AnonymousOnyx22/moodle-student-mcp) | Moodle for AI, read only. Due dates, overdue work, grades and announcements. |
| [Google Classroom MCP](https://github.com/AnonymousOnyx22/google-classroom-student-mcp) | Google Classroom for AI, read only. Todos, due dates, missing work and grades. |
| [Citations MCP](https://github.com/AnonymousOnyx22/student-citations-mcp) | APA, MLA and Chicago citations from a DOI, an ISBN or typed details. No account. |
| [Study Planner MCP](https://github.com/AnonymousOnyx22/study-planner-mcp) | Exam study schedules, spaced repetition dates, pomodoro plans and assignment milestones. Works offline. |
| [Paper Finder MCP](https://github.com/AnonymousOnyx22/paper-finder-student-mcp) | Search scholarly papers, find open access copies and related work through OpenAlex. No key needed. |

## License

MIT
