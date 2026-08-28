import { describe, it, expect, beforeEach } from "vitest";
import { encryptSecret, decryptSecret, type EncryptedSecret } from "./crypto";

const KEY_HEX = "0".repeat(64); // 32 bytes of zero, hex

describe("integration crypto", () => {
  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = KEY_HEX;
  });

  it("round-trips a secret", () => {
    const enc = encryptSecret("hunter2");
    expect(enc.v).toBe(1);
    expect(enc.data).not.toContain("hunter2");
    expect(decryptSecret(enc)).toBe("hunter2");
  });

  it("produces a different IV each call", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a.iv).not.toEqual(b.iv);
  });

  it("rejects tampered ciphertext (auth tag)", () => {
    const enc = encryptSecret("hunter2");
    const tampered: EncryptedSecret = { ...enc, data: enc.data.replace(/.$/, (c) => (c === "a" ? "b" : "a")) };
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws when the key is missing", () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
  });

  it("throws when the key is the wrong length", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = "abcd";
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
  });
});
