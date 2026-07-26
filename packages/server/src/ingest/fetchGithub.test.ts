import { test } from "node:test";
import assert from "node:assert/strict";
import { isMarkdownDocPath, parseGithubSource } from "./fetchGithub.js";

test("parseGithubSource acepta owner/repo y URLs de github.com", () => {
  assert.deepEqual(parseGithubSource("mikeljc-dev/docsera"), {
    owner: "mikeljc-dev",
    repo: "docsera",
  });
  assert.deepEqual(parseGithubSource("https://github.com/vercel/next.js"), {
    owner: "vercel",
    repo: "next.js",
  });
  assert.deepEqual(parseGithubSource("https://github.com/owner/repo.git/"), {
    owner: "owner",
    repo: "repo",
  });
});

test("parseGithubSource rechaza formatos inválidos", () => {
  assert.equal(parseGithubSource("no-es-un-repo"), null);
  assert.equal(parseGithubSource("https://gitlab.com/owner/repo"), null);
  assert.equal(parseGithubSource("owner/repo/extra"), null);
});

test("isMarkdownDocPath filtra por extensión y prefijo de carpeta", () => {
  assert.equal(isMarkdownDocPath("README.md"), true);
  assert.equal(isMarkdownDocPath("docs/guide.mdx"), true);
  assert.equal(isMarkdownDocPath("src/index.ts"), false);
  assert.equal(isMarkdownDocPath("docs/guide.md", "docs"), true);
  assert.equal(isMarkdownDocPath("README.md", "docs"), false);
  assert.equal(isMarkdownDocPath("docs2/x.md", "docs"), false);
  assert.equal(isMarkdownDocPath("docs/x.md", "/docs/"), true);
});
