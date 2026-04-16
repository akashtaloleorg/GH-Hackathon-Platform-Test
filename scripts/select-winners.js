#!/usr/bin/env node
// scripts/select-winners.js
// Reads the leaderboard JSON, selects top N entries, generates AI winner citations,
// optionally applies status/winner labels, and outputs winners_json to GITHUB_OUTPUT.

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

function httpsPost(hostname, apiPath, headers, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const options = {
      hostname, path: apiPath, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Invalid JSON: ${data.substring(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function githubPost(endpoint, body) {
  const [owner, repo] = (process.env.GITHUB_REPOSITORY || '/').split('/');
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'hackathon-winner-selection/1.0',
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function generateCitation(winner) {
  const model = process.env.EVAL_MODEL || 'gpt-4o';
  try {
    const result = await httpsPost(
      'models.inference.ai.azure.com',
      '/chat/completions',
      { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
      {
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an enthusiastic hackathon MC. Write a 2-sentence winner citation highlighting what made this project exceptional. Be specific, energetic, and professional. Output only the citation text, no labels.'
          },
          {
            role: 'user',
            content: `Project: ${winner.title}\nScore: ${winner.scores.total}/50\nTeam: ${winner.team}\nRank: #${winner.rank}`
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      }
    );
    return result.choices?.[0]?.message?.content?.trim() ||
           'An outstanding project with exceptional execution and real-world impact.';
  } catch (err) {
    console.log(`  Citation generation failed for "${winner.title}": ${err.message}`);
    return 'An outstanding project with exceptional execution and real-world impact.';
  }
}

async function main() {
  const topN   = parseInt(process.env.TOP_N   || '3', 10);
  const dryRun = process.env.DRY_RUN !== 'false';
  const [owner, repo] = (process.env.GITHUB_REPOSITORY || '/').split('/');

  // Load leaderboard
  const lbPath = path.join(process.cwd(), 'docs', '_data', 'leaderboard.json');
  if (!fs.existsSync(lbPath)) {
    console.error('Leaderboard not found at', lbPath);
    console.error('Run the Update Leaderboard workflow first.');
    process.exit(1);
  }
  const leaderboard = JSON.parse(fs.readFileSync(lbPath, 'utf8'));
  const entries = leaderboard.entries || [];

  if (entries.length === 0) {
    console.error('No evaluated entries in leaderboard. Nothing to select.');
    process.exit(1);
  }

  console.log(`Total entries: ${entries.length}`);
  console.log(`Selecting top ${topN} winner(s)...`);

  const winners = entries.slice(0, topN);

  // Generate AI citations
  for (const winner of winners) {
    console.log(`Generating citation for: ${winner.title} (${winner.scores.total}/50)`);
    winner.ai_citation = await generateCitation(winner);
    console.log(`  Citation: ${winner.ai_citation}`);
    await new Promise(r => setTimeout(r, 1000)); // rate-limit courtesy
  }

  console.log('\n=== Selected Winners ===');
  winners.forEach((w, i) => {
    const medals = ['🥇', '🥈', '🥉'];
    console.log(`${medals[i] || (i + 1 + '.')} ${w.title} — ${w.scores.total}/50 (${w.team})`);
  });

  if (!dryRun) {
    console.log('\nApplying winner labels...');
    for (const winner of winners) {
      await githubPost(
        `/repos/${owner}/${repo}/issues/${winner.issue_number}/labels`,
        { labels: ['status/winner', 'status/finalist'] }
      );
      console.log(`  Applied labels to issue #${winner.issue_number}`);
    }
  } else {
    console.log('\n[DRY RUN] No labels applied.');
    console.log('Re-run with dry_run=false to apply winner labels and create a Release.');
  }

  // Write output
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `winners_json=${JSON.stringify(winners)}\n`);
  }
}

main().catch(err => {
  console.error('Winner selection failed:', err.message);
  process.exit(1);
});
