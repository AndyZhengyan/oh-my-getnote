# PR Review Workflow

This project uses the `pr-review-toolkit` plugin for comprehensive pull request review. All 6 agents are available; use them in the sequence below.

## Agent Overview

| Agent | Focus | Model |
|---|---|---|
| `code-reviewer` | CLAUDE.md compliance, bugs, style | Opus |
| `silent-failure-hunter` | Error handling, catch blocks, silent failures | inherit |
| `type-design-analyzer` | Type encapsulation, invariants, enforcement | inherit |
| `pr-test-analyzer` | Test coverage gaps, edge cases | inherit |
| `comment-analyzer` | Comment accuracy, documentation quality | inherit |
| `code-simplifier` | Complexity reduction, clarity improvements | Opus |

## When to Use Each Agent

**Before committing (local, as you write code):**
- `code-reviewer` — always, after any code change
- `silent-failure-hunter` — when you added or modified try/catch, fallback logic, or error paths
- `type-design-analyzer` — when you introduced or refactored a type/interface/data model

**Before creating a PR (final sweep):**
- `pr-test-analyzer` — always, to catch missing test coverage before review
- `comment-analyzer` — when you added or modified comments/docs
- `code-reviewer` — final quality check before opening the PR

**After PR review passes (polish):**
- `code-simplifier` — run once to reduce complexity and improve maintainability; only after all other agents have cleared or approved the changes

## Recommended Sequence

Run agents in this order for a complete review:

```
1. code-reviewer       # General quality, bugs, CLAUDE.md compliance
2. silent-failure-hunter  # Error handling audit (conditional on changes)
3. type-design-analyzer   # Type design quality (conditional on new types)
4. pr-test-analyzer    # Test coverage gaps
5. comment-analyzer    # Documentation accuracy (conditional on comment changes)
6. code-simplifier     # Polish (only after steps 1-5 are clean)
```

Run steps 1-5 sequentially for clarity, or request them in parallel by saying:
```
Run code-reviewer, silent-failure-hunter, pr-test-analyzer in parallel
```

Run `code-simplifier` sequentially after everything else — it refines code after the review has passed.

## Score Thresholds and Decision Rules

### code-reviewer (0-100)
| Score | Action |
|---|---|
| 91-100 | **Must fix before PR** — critical bug or explicit CLAUDE.md violation |
| 80-90 | **Should fix** — important issue worth addressing |
| 51-79 | **Consider** — valid but low-impact; use judgment |
| 0-50 | **Ignore** — likely false positive or pre-existing issue |

Report only issues with confidence >= 80.

### pr-test-analyzer (1-10 per gap)
| Rating | Action |
|---|---|
| 9-10 | **Must add test** — could cause data loss, security issues, or system failures |
| 7-8 | **Should add test** — important business logic; user-facing errors possible |
| 5-6 | **Consider** — edge cases causing confusion or minor issues |
| 3-4 | **Nice-to-have** — completeness coverage |
| 1-2 | **Optional** — minor improvement |

### type-design-analyzer (1-10 per dimension)
| Dimension | What it measures |
|---|---|
| Encapsulation | Are internal details hidden? Can invariants be violated from outside? |
| Invariant Expression | How clearly are constraints communicated in the type structure? |
| Invariant Usefulness | Do the invariants prevent real bugs? |
| Invariant Enforcement | Are invariants checked at construction? Is invalid state unrepresentable? |

**Rule of thumb:** Flag any dimension rated below 6, especially if multiple dimensions are low.

### silent-failure-hunter (severity levels)
| Severity | Meaning |
|---|---|
| CRITICAL | Silent failure or overly broad catch block |
| HIGH | Poor error message, unjustified fallback behavior |
| MEDIUM | Missing context in logs, could be more specific |

Any CRITICAL or HIGH finding must be resolved before merge.

### comment-analyzer
No numeric score. Flag:
- Factually incorrect or misleading comments (Critical Issues)
- Incomplete or could be enhanced (Improvement Opportunities)
- No-value or confusing comments — recommend removal

### code-simplifier
No numeric score. Identifies complexity and suggests concrete simplifications. All suggestions preserve functionality.

## How to Invoke

Use the skill directly:
```
/pr-review-toolkit:review-pr              # Run all applicable agents
/pr-review-toolkit:review-pr code errors  # Specific aspects only
/pr-review-toolkit:review-pr all parallel # Parallel mode (faster)
/pr-review-toolkit:review-pr simplify     # Code simplification only
```

Or trigger individual agents by asking naturally:
```
"Can you check if everything looks good?"         → code-reviewer
"Review the error handling I added"                → silent-failure-hunter
"Analyze the types I added"                        → type-design-analyzer
"Check if the tests cover all edge cases"         → pr-test-analyzer
"Verify the comments I added are accurate"         → comment-analyzer
"Simplify this implementation"                     → code-simplifier
```

## Per-Review Checklist

**Before committing:**
- [ ] `code-reviewer` score >= 80 on all findings (no critical issues)
- [ ] `silent-failure-hunter` — no CRITICAL/HIGH findings remaining

**Before creating PR:**
- [ ] `pr-test-analyzer` — no gaps rated 9-10 remaining
- [ ] `comment-analyzer` — no critical comment issues remaining
- [ ] `type-design-analyzer` — no dimensions rated below 5
- [ ] `code-reviewer` — final pass is clean

**After review feedback:**
- [ ] Re-run relevant agents to verify fixes before pushing updates

**Polish (after all above are clean):**
- [ ] `code-simplifier` — apply clarity improvements

## Tips

- Focus on **changed files only** — use `git diff` or specify file paths to keep reviews fast and relevant.
- Fix critical issues first, then re-run to confirm before addressing lower-priority findings.
- Do not run `code-simplifier` before other agents pass — it should be the final step, not a replacement for review.
- For small, uncontroversial changes (typo fixes, comment rewrites), run only the relevant agent rather than the full suite.
