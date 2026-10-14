# GPA Calculator MCP

[![npm](https://img.shields.io/npm/v/gpa-calculator-mcp.svg)](https://www.npmjs.com/package/gpa-calculator-mcp)
[![downloads](https://img.shields.io/npm/dm/gpa-calculator-mcp.svg)](https://www.npmjs.com/package/gpa-calculator-mcp)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Ask your AI to work out your GPA, convert grades between letters and percentages, and figure out what you need on the final. The math is done by tested code, not guessed by the model.

This is a free, open source [MCP](https://modelcontextprotocol.io) server. It works with Claude, ChatGPT, Cursor, VS Code Copilot and any other app that supports MCP. It runs on your computer, needs no internet and no login, and never sees your school account.

Free forever. No account and no subscription.

## Quick start

Add this to your AI app's MCP config. For Claude Desktop that is `claude_desktop_config.json`.

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

Restart your AI app, then try one of the questions below. You need Node.js 20 or newer.

For Claude Code, run `claude mcp add gpa -- npx -y gpa-calculator-mcp`.

## What you can ask

- "What's my GPA if I got an A in 3 credits, a B+ in 4 credits and a C in 3 credits?"
- "What do I need on the final to get an 80 if it's worth 40% and I'm at 74 right now?"
- "Convert 78 percent to a letter grade on the Ontario college scale."
- "I have a 3.1 GPA over 60 credits. What GPA do I need next semester to reach 3.4?"
- "My course is 20% quizzes, 30% labs, 50% exam. I have 85 on quizzes and 70 on labs. What's my grade so far and what's the best I can finish with?"

## Tools

| Tool | What it does |
| --- | --- |
| `calculate_gpa` | GPA for a list of courses with credits and grades, optionally combined with your earlier GPA |
| `convert_grade` | Convert a letter or percentage to the matching letter, percentage range and grade points |
| `needed_on_final` | The score you need on the final to hit a target, and whether it is possible |
| `weighted_grade` | Your grade so far and your best and worst possible finish from weighted parts |
| `target_gpa_planner` | The GPA you need on upcoming credits to reach a target cumulative GPA |
| `list_scales` | The grade scales built in, with their letter, percentage and points tables |

## Grade scales

| Scale id | Description |
| --- | --- |
| `us4` | Common US 4.0 scale with plus and minus grades, A is 4.0 and A- is 3.7 |
| `us4plus` | Same as `us4` but A+ is 4.3 |
| `ontario-college` | A common Ontario college 4.0 scale, A+ and A are 4.0, B+ is 3.5. Check your own school's table |

Schools differ. Run `list_scales` to see the exact table used, and tell your AI if your school's cutoffs are different.


## Development

```bash
npm install
npm run build
npm test
```

The tests call every tool through a real MCP client, so they need no account or network.

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
