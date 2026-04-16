---
layout: default
title: Rules & Guidelines
---

# Hackathon Rules & Guidelines

## Eligibility

All participants must have a GitHub account. Teams may consist of 1 to 5 members. Each team may submit only one solution per challenge. Organizers and judges may not submit solutions.

---

## Submission Types

### Challenge Submissions
- Must define a clear, solvable problem with measurable success criteria
- Must be submitted during the Registration phase
- Organizers may edit or reject challenges that do not meet quality standards

### Idea Submissions
- Must reference a specific Challenge by issue number
- Must be submitted before the Idea Submission deadline
- Ideas are optional — you may submit a Solution without a prior Idea

### Solution Submissions
- The project repository must be **public** on GitHub
- All code must have been written **during the hackathon period** (prior open-source libraries are permitted)
- `README.md` must include setup and run instructions
- Submissions close at **11:59 PM UTC** on the final day
- You may update your submission (edit the issue) until the deadline

---

## Judging Criteria

All solutions are scored on five dimensions, each worth 0–10 points (50 total):

| Dimension | Weight | Description |
|-----------|--------|-------------|
| **Innovation** | 20% | Novelty of the approach — how creatively does it solve the problem? |
| **Technical Quality** | 20% | Code quality, architecture decisions, completeness of implementation |
| **Documentation** | 20% | Clarity of README, setup guide, and in-code documentation |
| **Feasibility** | 20% | Realistic path to production; evidence of working prototype or MVP |
| **Impact** | 20% | Potential real-world benefit and scalability |

### Evaluation Process
1. **Automated scoring** — GitHub Actions triggers the GitHub Models API (GPT-4o) to score each submission using the rubric above. Scores appear as a comment on the submission issue within ~2 minutes.
2. **Human review** — Judges review AI scores for all finalist submissions and may adjust rankings.
3. **Winner selection** — The `select-winners` workflow is run by organizers with human approval required via the `Results` environment gate.

---

## AI Tools & Attribution

Participants **may** use AI coding assistants (GitHub Copilot, ChatGPT, etc.) in their solutions.  
AI usage **must be disclosed** in the submission under Technical Implementation.  
AI-generated code without attribution is grounds for disqualification.

---

## Code of Conduct

All participants must adhere to the [GitHub Community Guidelines](https://docs.github.com/en/site-policy/github-terms/github-community-guidelines). Violations may result in disqualification.

## Intellectual Property

- Participants retain full ownership of their submitted work.
- By submitting, participants grant the organizers the right to showcase their work publicly (on the leaderboard, in release notes, and on social media).
- All submitted code must be original work or properly licensed open-source components.

## Disputes & Appeals

If you believe your evaluation scores are incorrect, open a GitHub Discussion in the **Appeals** category within **48 hours** of score publication. Describe which dimension you believe was scored incorrectly and why. Organizers will review and may trigger a re-evaluation.

---

## Disqualification

A submission may be disqualified for:
- Code submitted before the hackathon start date
- Plagiarized or unlicensed third-party code without attribution
- Code of Conduct violations
- Incomplete submission (missing public repo, no README)
- Coordinated manipulation of the evaluation system

---

*Questions? Ask in [GitHub Discussions → Q&A](https://github.com/akashtalole/gh-hackathon-platform/discussions).*
