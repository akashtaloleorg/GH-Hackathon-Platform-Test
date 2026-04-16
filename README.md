# GitHub Hackathon Platform

A fully GitHub-native hackathon platform — no separate backend, no external services. Everything runs on GitHub: Issues, Actions, Projects, Discussions, Pages, and Releases. Solutions are evaluated automatically by **GPT-4o via the GitHub Models API**.

## How It Works

| Feature | GitHub Primitive |
|---------|-----------------|
| Submission intake | GitHub Issues + Issue Forms (3 structured templates) |
| Submission tracking | Labels + Milestones |
| Judging board | GitHub Projects v2 (custom scoring fields) |
| Community Q&A | GitHub Discussions |
| AI evaluation | GitHub Actions + GitHub Models API (GPT-4o) |
| Leaderboard | GitHub Pages (`docs/`) |
| Phase gating | GitHub Environments (Registration → Submission → Judging → Results) |
| Winner announcement | GitHub Releases |

## Submission Types

| Type | Issue Template | Label |
|------|---------------|-------|
| **Challenge** | `challenge-submission.yml` | `type/challenge` |
| **Idea** | `idea-submission.yml` | `type/idea` |
| **Solution** | `solution-submission.yml` | `type/solution` |

## Evaluation Rubric (50 points total)

| Dimension | Max | Description |
|-----------|-----|-------------|
| Innovation | 10 | Novelty and creativity of the approach |
| Technical Quality | 10 | Code quality, architecture, completeness |
| Documentation | 10 | README clarity, setup instructions |
| Feasibility | 10 | Realistic implementation path |
| Impact | 10 | Potential real-world benefit and scale |

Scoring runs automatically via `evaluate-submission.yml` when a solution issue is labeled `status/pending-evaluation`. Results appear as a comment on the issue within ~2 minutes.

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `evaluate-submission.yml` | Issue labeled `status/pending-evaluation` | AI scoring via GitHub Models API |
| `update-leaderboard.yml` | Dispatch / schedule / bot label | Regenerate `docs/_data/leaderboard.json` + deploy Pages |
| `select-winners.yml` | Manual dispatch | Select winners, apply labels, create Release |
| `phase-gate.yml` | Manual dispatch | Advance hackathon phase with organizer approval |
| `setup-repository.yml` | Manual dispatch (one-time) | Bootstrap labels, milestones, Projects v2 |

## First-Time Setup

1. **Bootstrap the repo** — Run the `setup-repository.yml` workflow. This creates all labels, milestones, and the Projects v2 judging board.
2. **Set `PROJECT_NUMBER`** — Copy the project number from the workflow output and add it as a repository variable: `Settings → Secrets and Variables → Actions → Variables`.
3. **Enable GitHub Pages** — `Settings → Pages → Source: Deploy from branch → Branch: main, Folder: /docs`.
4. **Enable Discussions** — `Settings → General → Features → Discussions`.
5. **Create Discussion categories** — Q&A, Ideas, Show & Tell, Announcements (organizer-only), Appeals.
6. **Create Environments** — `Settings → Environments`: `Registration`, `Submission`, `Judging`, `Results`. Add a required reviewer on the `Results` environment.
7. **Open the hackathon** — Run the `phase-gate.yml` workflow with `target_phase: Registration`.

## Repository Variables & Secrets

| Name | Type | Purpose |
|------|------|---------|
| `GITHUB_TOKEN` | Auto-injected | Issues, Projects, Models API (needs `models: read` in workflow) |
| `PROJECT_NUMBER` | Repository Variable | GitHub Projects v2 board number |
| `EVAL_MODEL` | Repository Variable | AI model (default: `gpt-4o`) |
| `PROJECT_TOKEN` | Repository Secret (optional) | Classic PAT with `project` scope for personal repos |

## Pros & Cons

### Pros
- Zero infrastructure cost — no servers or databases to manage
- Zero participant friction — existing GitHub accounts work
- AI evaluation is free and keyless — `GITHUB_TOKEN` authenticates with GitHub Models API
- Full audit trail — every action is versioned and publicly auditable
- Code is verifiable — submissions link to real repos that judges can inspect

### Cons
- Issue Forms have no conditional logic — mitigated by 3 separate templates
- Projects v2 requires one-time script setup (not declarative YAML)
- Models API rate limits apply (~150 req/day free tier) — batch evaluation if needed
- No built-in payment/prize management — handle externally
- Submission visibility is public by default (use a private repo for confidential judging)

## License

MIT — see [LICENSE](LICENSE).
