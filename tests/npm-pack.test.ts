import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const npmBin = process.platform === "win32" ? "cmd" : "npm";

function npm(args: string[]): string {
  const fullArgs = process.platform === "win32" ? ["/c", "npm.cmd", ...args] : args;
  return execFileSync(npmBin, fullArgs, { cwd: process.cwd(), stdio: "pipe", encoding: "utf8" });
}

const readJson = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

describe("npm pack smoke test for the bin", () => {
  it("packs a tarball that contains build/src and runs its bin", () => {
    const pkg = readJson("package.json");
    const tarballName = `${pkg.name}-${pkg.version}.tgz`;

    npm(["run", "build"]);

    const work = mkdtempSync(join(tmpdir(), "gpa-calculator-pack-"));
    try {
      npm(["pack", "--pack-destination", work]);

      const tarball = join(work, tarballName);
      const extracted = join(work, "extracted");
      mkdirSync(extracted, { recursive: true });
      execFileSync("tar", ["-xzf", tarball, "-C", extracted], { stdio: "pipe" });

      const packageDir = join(extracted, "package");
      const bin = join(packageDir, "build", "src", "index.js");

      expect(existsSync(bin), "the packed tarball contains build/src/index.js").toBe(true);
      expect(existsSync(join(packageDir, "package.json")), "the packed tarball contains package.json").toBe(true);

      const packed = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
      expect(packed.bin, "the packed package.json keeps the bin").toEqual(pkg.bin);

      const smokeDir = join(process.cwd(), "node_modules", ".gpa-calculator-pack-smoke");
      rmSync(smokeDir, { recursive: true, force: true });
      cpSync(packageDir, smokeDir, { recursive: true });
      try {
        const version = execFileSync("node", [join(smokeDir, "build", "src", "index.js"), "--version"], {
          encoding: "utf8",
          stdio: "pipe",
        });
        expect(version.trim()).toBe(pkg.version);

        const help = execFileSync("node", [join(smokeDir, "build", "src", "index.js"), "--help"], {
          encoding: "utf8",
          stdio: "pipe",
        });
        expect(help).toContain("gpa-calculator-mcp");
      } finally {
        rmSync(smokeDir, { recursive: true, force: true });
      }
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});
