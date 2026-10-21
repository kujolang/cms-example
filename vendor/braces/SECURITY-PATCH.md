# Local braces security fork

Upstream: micromatch/braces 3.0.3, MIT license preserved. This private, repository-owned fork is installed through the root npm override; it is not a published upstream release.

GHSA-vfj7-8cjw-p6xm / CVE-2026-93687 has no patched upstream version as of 2026-10-21. Parser stack growth and each recursive AST walker (compile, expand, stringify) are bounded to 128 AST levels, including direct lib imports and caller-supplied ASTs. Excess depth throws SyntaxError with code ERR_BRACES_DEPTH before stack exhaustion; options cannot disable this bound. Ordinary pattern syntax and existing range limits are retained. This is an intentional compatibility limit for extreme nesting.

The fork identity makes its maintenance ownership explicit; a clean registry audit alone is not proof of this local patch. npm run check also runs dependency-security tests against installed transitive copies, malicious nested brace/parenthesis and AST inputs, and ordinary glob/expansion controls. Keep those tests and the audit gate enabled. Replace the fork with an upstream patched release when available and rerun the full gate.
