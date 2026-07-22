# Security Policy

**English** · [Español](./SECURITY.es.md)

## Supported versions

Docsera is a young, actively developed project without a long-term support
policy yet. Security fixes go into the latest release; there's no backport
process to older versions. Always run the latest tag.

## Reporting a vulnerability

Please **do not** open a public issue for a security vulnerability. Use
GitHub's [private vulnerability reporting](../../security/advisories/new)
for this repository instead — it opens a private conversation with the
maintainer and, if the report turns out to be a real vulnerability, can
turn directly into a GitHub Security Advisory and a coordinated fix.

Include what you'd include in a normal bug report — steps to reproduce,
affected version/commit, and impact — plus anything specific to the
report being security-sensitive (e.g. whether it needs a deployed instance
reachable from the internet, or local/self-hosted access is enough).

## Scope

Docsera is self-hosted: in the default configuration, a report about
*your own* deployment (misconfigured `ADMIN_TOKEN`, an exposed `.env`,
etc.) isn't a vulnerability in the project. Relevant reports are about the
code itself — the server, the widget, the CLI, or the Docker image —
regardless of who's running it.

The public demo at [docs.docsera.dev](https://docs.docsera.dev) is a real,
internet-facing deployment; issues found against it that reproduce against
the open-source code are in scope.
