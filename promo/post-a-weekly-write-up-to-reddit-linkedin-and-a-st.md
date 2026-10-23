Meant for: a college or student subreddit, a LinkedIn post, and a student Discord study or tools channel.

Every semester I end up doing the same GPA math in my head or in a messy spreadsheet, and I wanted the app I already use to do it without signing into anything. So I built GPA Calculator MCP.

It is an open source MCP server with seven tools. You can work out a term GPA or a CGPA, plan the GPA you need next term, see the lowest letter each upcoming course needs, convert a letter to a percentage, work out what you need on the final, and combine weighted course parts. There are six grade scales, including US 4.0, Ontario college, UK classification and Australian HD.

It runs on your computer. No account, no login, no internet, and it never touches your school account. The math is tested code, not a guess.

Install it with:

```bash
npx -y gpa-calculator-mcp
```

Then add it to the MCP config of Claude Desktop, Cursor, VS Code Copilot, ChatGPT or any other app that supports MCP. The README has the exact config for each one.

If you try it and a number looks wrong, tell me. I would rather fix a scale table than have someone plan a semester on a bad number.
