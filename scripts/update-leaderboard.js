#!/usr/bin/env node
// scripts/update-leaderboard.js
// Fetches all evaluated solution issues, extracts scores from AI evaluation comments,
// and writes docs/_data/leaderboard.json for the GitHub Pages site.

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

function githubGet(endpoint) {
  const [owner, repo] = (process.env.GITHUB_REPOSITORY || '/').split('/');
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'hackathon-leaderboard/1.0',
        Accept: 'application/vnd.github+json'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Invalid JSON from ${endpoint}: ${data.substring(0, 100)}`)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function getAllPages(endpoint) {
  const results = [];
  let page = 1;
  while (true) {
    const sep = endpoint.includes('?') ? '&' : '?';
    const data = await githubGet(`${endpoint}${sep}page=${page}&per_page=100`);
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return results;
}

function parseScores(commentBody) {
  const scores = {};
  const rows = [
    ['innovation',       /\|\s*Innovation\s*\|\s*(\d+)\/10/i],
    ['technical_quality',/\|\s*Technical Quality\s*\|\s*(\d+)\/10/i],
    ['documentation',    /\|\s*Documentation\s*\|\s*(\d+)\/10/i],
    ['feasibility',      /\|\s*Feasibility\s*\|\s*(\d+)\/10/i],
    ['impact',           /\|\s*Impact\s*\|\s*(\d+)\/10/i],
  ];
  for (const [key, re] of rows) {
    const m = commentBody.match(re);
    if (m) scores[key] = parseInt(m[1], 10);
  }
  const totalMatch = commentBody.match(/\|\s*\*\*Total\*\*\s*\|\s*\*\*(\d+)\/50\*\*/i);
  if (totalMatch) scores.total = parseInt(totalMatch[1], 10);
  return Object.keys(scores).length >= 5 ? scores : null;
}

function extractField(body, label) {
  // Matches "### Label\n\nvalue" or "### Label\nvalue" patterns from Issue Forms
  const re = new RegExp(`###\\s+${label}\\s*\\n+([^#]+)`, 'i');
  const m = body.match(re);
  return m ? m[1].trim() : null;
}

async function main() {
  const [owner, repo] = (process.env.GITHUB_REPOSITORY || '/').split('/');

  console.log(`Fetching evaluated solution issues from ${owner}/${repo}...`);

  const issues = await getAllPages(
    `/repos/${owner}/${repo}/issues?labels=type%2Fsolution,bot%2Fevaluated&state=open`
  );
  console.log(`Found ${issues.length} evaluated solution(s)`);

  const entries = [];

  for (const issue of issues) {
    const comments = await githubGet(
      `/repos/${owner}/${repo}/issues/${issue.number}/comments?per_page=100`
    );

    const evalComment = Array.isArray(comments)
      ? comments.find(c =>
          (c.user.login === 'github-actions[bot]' || c.user.type === 'Bot') &&
          c.body.includes('AI Evaluation Report')
        )
      : null;

    if (!evalComment) {
      console.log(`  #${issue.number}: no evaluation comment found, skipping`);
      continue;
    }

    const scores = parseScores(evalComment.body);
    if (!scores) {
      console.log(`  #${issue.number}: could not parse scores, skipping`);
      continue;
    }

    const body = issue.body || '';
    const repoUrlMatch   = body.match(/https:\/\/github\.com\/[^\s\n)]+/);
    const teamMatch      = extractField(body, 'Team Members \\(GitHub usernames\\)');
    const challengeMatch = body.match(/#(\d+)/);

    entries.push({
      rank:           0,
      issue_number:   issue.number,
      title:          issue.title.replace(/^\[SOLUTION\]\s*/i, '').trim(),
      submitter:      issue.user.login,
      team:           teamMatch || issue.user.login,
      challenge_issue: challengeMatch ? parseInt(challengeMatch[1], 10) : null,
      repo_url:        repoUrlMatch ? repoUrlMatch[0] : null,
      labels:          issue.labels.map(l => l.name),
      scores: {
        innovation:       scores.innovation       || 0,
        technical_quality: scores.technical_quality || 0,
        documentation:    scores.documentation    || 0,
        feasibility:      scores.feasibility      || 0,
        impact:           scores.impact           || 0,
        total:            scores.total            || 0
      },
      is_finalist: issue.labels.some(l => l.name === 'status/finalist'),
      is_winner:   issue.labels.some(l => l.name === 'status/winner'),
      evaluated_at: evalComment.created_at,
      issue_url:    issue.html_url
    });

    console.log(`  #${issue.number}: ${issue.title} — ${scores.total}/50`);
  }

  entries.sort((a, b) => b.scores.total - a.scores.total);
  entries.forEach((e, i) => { e.rank = i + 1; });

  const output = {
    generated_at:       new Date().toISOString(),
    total_submissions:  entries.length,
    entries
  };

  const outPath = path.join(process.cwd(), 'docs', '_data', 'leaderboard.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\nLeaderboard written to ${outPath}`);
  console.log(`Total evaluated entries: ${entries.length}`);
  if (entries.length > 0) {
    console.log(`Top entry: "${entries[0].title}" — ${entries[0].scores.total}/50`);
  }
}

main().catch(err => {
  console.error('Leaderboard update failed:', err.message);
  process.exit(1);
});
