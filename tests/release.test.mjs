import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/lib/release.ts", import.meta.url),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { isRelease } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
const record = {
  name: "TEST FIXTURE",
  symbol: "TEST",
  description: "Synthetic validation record, never published.",
  website: "https://example.invalid",
  twitter: "",
  token: "0x" + "a".repeat(40),
  hash: "0x" + "b".repeat(64),
  block: "123",
  proof: "c".repeat(64),
  brainCommit: "d".repeat(64),
  hits: 8,
  buyTaxBps: 200,
  sellTaxBps: 200,
};

test("accepts a complete publisher-shaped record", () =>
  assert.equal(isRelease(record), true));
test("a contract alone must never become a release claim", () => {
  for (const data of [
    null,
    [],
    {},
    "<html>fallback</html>",
    { token: record.token },
    { ...record, proof: undefined },
    { ...record, hits: 7 },
  ])
    assert.equal(isRelease(data), false);
});
test("rejects malformed addresses, fingerprints and blocks", () => {
  for (const patch of [
    { token: "javascript:alert(1)" },
    { hash: "0x123" },
    { brainCommit: "x".repeat(64) },
    { proof: "c".repeat(63) },
    { block: "0" },
    { block: "12e3" },
  ])
    assert.equal(isRelease({ ...record, ...patch }), false);
});
test("rejects non-integral or out-of-range tax values", () => {
  for (const value of [-1, 10001, NaN, Infinity, "200", 2.5]) {
    assert.equal(isRelease({ ...record, buyTaxBps: value }), false);
    assert.equal(isRelease({ ...record, sellTaxBps: value }), false);
  }
});
