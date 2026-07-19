import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEnvFile } from "./envFile.js";

test("parseEnvFile ignora comentarios y líneas vacías", () => {
  const env = parseEnvFile("# comment\n\nFOO=bar\n  BAZ = qux \n");
  assert.deepEqual(env, { FOO: "bar", BAZ: "qux" });
});

test("parseEnvFile desentrecomilla valores escritos por buildEnvFile", () => {
  const env = parseEnvFile('KEY="a value with spaces"');
  assert.deepEqual(env, { KEY: "a value with spaces" });
});

test("parseEnvFile ignora líneas sin = o sin clave", () => {
  const env = parseEnvFile("novalue\n=orphan\nOK=1");
  assert.deepEqual(env, { OK: "1" });
});
