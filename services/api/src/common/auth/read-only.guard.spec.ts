import { describe, it, expect } from "vitest";
import { isWriteBlocked } from "./read-only.guard";

describe("isWriteBlocked", () => {
  it("never blocks reads, even when frozen", () => {
    expect(isWriteBlocked("GET", false, "read_only")).toBe(false);
    expect(isWriteBlocked("HEAD", false, "none")).toBe(false);
    expect(isWriteBlocked("OPTIONS", false, "read_only")).toBe(false);
  });

  it("blocks a business user's writes when frozen (read_only)", () => {
    expect(isWriteBlocked("POST", false, "read_only")).toBe(true);
    expect(isWriteBlocked("PATCH", false, "read_only")).toBe(true);
    expect(isWriteBlocked("PUT", false, "read_only")).toBe(true);
    expect(isWriteBlocked("DELETE", false, "read_only")).toBe(true);
  });

  it("blocks writes when archived (none)", () => {
    expect(isWriteBlocked("POST", false, "none")).toBe(true);
  });

  it("allows writes when the dashboard is full", () => {
    expect(isWriteBlocked("POST", false, "full")).toBe(false);
    expect(isWriteBlocked("DELETE", false, "full")).toBe(false);
  });

  it("platform admins bypass — they reactivate frozen tenants", () => {
    expect(isWriteBlocked("POST", true, "read_only")).toBe(false);
    expect(isWriteBlocked("DELETE", true, "none")).toBe(false);
  });

  it("is case-insensitive on the method", () => {
    expect(isWriteBlocked("post", false, "read_only")).toBe(true);
    expect(isWriteBlocked("get", false, "read_only")).toBe(false);
  });
});
