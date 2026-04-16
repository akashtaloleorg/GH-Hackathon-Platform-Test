#!/usr/bin/env node
// scripts/evaluate.js
// Calls GitHub Models API to score a solution submission using a structured rubric.
// Reads issue content from env vars. Writes evaluation_json to GITHUB_OUTPUT.

'use strict';

const https = require('https');
const fs = require('fs');

const RUBRIC = `You are an expert hackathon judge. Evaluate the submitted project using the rubric below.
Return ONLY valid JSON — no markdown fences, no explanation outside the JSON object.

## Scoring Rubric (each dimension: 0–10)

### Innovation (0-10)
- 0-2: Trivially replicates existing solutions with no novel elements
- 3-4: Minor improvement over existing approaches
- 5-6: Meaningful new combination of technologies or approaches
- 7-8: Novel technical approach or genuinely new user experience
- 9-10: Breakthrough approach that fundamentally changes how the problem is solved

### Technical Quality (0-10)
- 0-2: No working code, broken links, or trivial implementation
- 3-4: Basic implementation with significant gaps or bugs described
- 5-6: Functional implementation with reasonable architecture described
- 7-8: Well-architected, clean code, appropriate technology choices
- 9-10: Production-quality decisions with exceptional engineering depth

### Documentation (0-10)
- 0-2: No documentation or completely unclear submission
- 3-4: Minimal description, missing key information
- 5-6: Adequate description of the project and how to use it
- 7-8: Thorough README, clear setup, architecture explained
- 9-10: Exemplary docs with architecture diagrams, API docs, and deployment guides

### Feasibility (0-10)
- 0-2: Not realistically achievable or no credible path forward
- 3-4: High technical risk with unclear implementation path
- 5-6: Achievable with significant effort, realistic timeline
- 7-8: Well-scoped, achievable within reasonable constraints
- 9-10: Clear execution path with evidence of prototype or MVP

### Impact (0-10)
- 0-2: Solves a trivial problem or affects very few people
- 3-4: Limited scope of impact, marginal improvement
- 5-6: Meaningful impact for a defined audience
- 7-8: Significant potential impact for a broad audience
- 9-10: Transformative potential impact, scalable to millions

## Required JSON Output Format
{
  "innovation": <integer 0-10>,
  "innovation_rationale": "<one concise sentence>",
  "technical_quality": <integer 0-10>,
  "technical_quality_rationale": "<one concise sentence>",
  "documentation": <integer 0-10>,
  "documentation_rationale": "<one concise sentence>",
  "feasibility": <integer 0-10>,
  "feasibility_rationale": "<one concise sentence>",
  "impact": <integer 0-10>,
  "impact_rationale": "<one concise sentence>",
  "strengths": "<2-3 bullet points in markdown>",
  "improvements": "<2-3 bullet points in markdown>",
  "summary": "<2-3 sentence overall assessment>"
}`;

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const options = {
      hostname,
      path,
      method: 'POST',
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
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 300)}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid JSON response: ${data.substring(0, 200)}`));
          }
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function callModelsAPI(systemPrompt, userContent) {
  const model = process.env.EVAL_MODEL || 'gpt-4o';
  const result = await httpsPost(
    'models.inference.ai.azure.com',
    '/chat/completions',
    { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    }
  );
  return result.choices[0].message.content;
}

async function withRetry(fn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const delay = Math.pow(2, attempt - 1) * 1500 + Math.random() * 500;
      console.log(`Attempt ${attempt} failed (${err.message}). Retrying in ${Math.round(delay)}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function main() {
  const issueNumber = process.env.ISSUE_NUMBER || '?';
  const issueTitle  = process.env.ISSUE_TITLE  || '';
  const issueBody   = process.env.ISSUE_BODY   || '';
  const issueUser   = process.env.ISSUE_USER   || '';

  if (!issueBody.trim()) {
    throw new Error('Issue body is empty — nothing to evaluate.');
  }

  const userContent = `## Hackathon Submission #${issueNumber} by @${issueUser}

**Title:** ${issueTitle}

---

${issueBody}`;

  console.log(`Evaluating issue #${issueNumber}: ${issueTitle}`);
  console.log(`Content length: ${issueBody.length} chars`);

  const rawResult = await withRetry(() => callModelsAPI(RUBRIC, userContent));

  let evaluation;
  try {
    evaluation = JSON.parse(rawResult);
  } catch {
    throw new Error(`Model returned non-JSON: ${rawResult.substring(0, 300)}`);
  }

  const scoreFields = ['innovation', 'technical_quality', 'documentation', 'feasibility', 'impact'];
  for (const field of scoreFields) {
    const val = Number(evaluation[field]);
    if (!Number.isFinite(val) || val < 0 || val > 10) {
      throw new Error(`Invalid score for '${field}': ${evaluation[field]}`);
    }
    evaluation[field] = Math.round(val);
  }

  const total = scoreFields.reduce((sum, f) => sum + evaluation[f], 0);
  console.log('\nScores:');
  scoreFields.forEach(f => console.log(`  ${f}: ${evaluation[f]}/10`));
  console.log(`  TOTAL: ${total}/50`);

  const evaluationJson = JSON.stringify(evaluation);
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `evaluation_json=${evaluationJson}\n`);
  } else {
    console.log('\nEVALUATION_JSON:', evaluationJson);
  }
}

main().catch(err => {
  console.error('Evaluation failed:', err.message);
  process.exit(1);
});
