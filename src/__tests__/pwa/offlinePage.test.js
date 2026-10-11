import { readFileSync } from "fs";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

describe("offline.html", () => {
  const html = readFileSync(join(root, "public", "offline.html"), "utf8");

  it("exists and is valid HTML", () => {
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("shows offline message", () => {
    expect(html).toMatch(/offline/i);
  });

  it("does not link to any external resources", () => {
    expect(html).not.toMatch(/<link[^>]+href="https?:\/\//i);
    expect(html).not.toMatch(/<script[^>]+src="https?:\/\//i);
  });

  it("does not reference protected routes", () => {
    expect(html).not.toContain("/dashboard");
    expect(html).not.toContain("/member/home");
    expect(html).not.toContain("/payment");
  });

  it("uses inline styles only", () => {
    expect(html).toContain("<style>");
    expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/i);
  });
});

describe("maskable icon", () => {
  it("exists at the expected path", () => {
    const iconPath = join(root, "public", "maskable-icon-512.png");
    expect(existsSync(iconPath)).toBe(true);
  });

  it("has correct PNG dimensions (512x512)", () => {
    const iconPath = join(root, "public", "maskable-icon-512.png");
    const buf = readFileSync(iconPath);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    expect(width).toBe(512);
    expect(height).toBe(512);
  });
});
