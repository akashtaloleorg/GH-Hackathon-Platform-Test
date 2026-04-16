#!/usr/bin/env node
// scripts/update-project-fields.js
// Adds the evaluated issue to GitHub Projects v2 and updates scoring number fields
// via GraphQL mutations. Non-fatal on failure (evaluation comment already posted).

'use strict';

const https = require('https');

function graphql(query, variables) {
  const payload = JSON.stringify({ query, variables });
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'hackathon-evaluation-bot/1.0',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.errors) {
            reject(new Error(`GraphQL errors: ${JSON.stringify(parsed.errors)}`));
          } else {
            resolve(parsed.data);
          }
        } catch {
          reject(new Error(`Invalid GraphQL response: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const evaluation   = JSON.parse(process.env.EVALUATION_JSON);
  const issueNodeId  = process.env.ISSUE_NODE_ID;
  const projectNum   = parseInt(process.env.PROJECT_NUMBER || '0', 10);
  const [owner]      = (process.env.GITHUB_REPOSITORY || '/').split('/');

  if (!projectNum) {
    console.log('PROJECT_NUMBER not set. Skipping project field update.');
    return;
  }

  // Resolve project — try as user first, then org
  let project = null;
  try {
    const userData = await graphql(`
      query($owner: String!, $num: Int!) {
        user(login: $owner) {
          projectV2(number: $num) {
            id
            fields(first: 30) {
              nodes {
                ... on ProjectV2Field { id name dataType }
              }
            }
          }
        }
      }`, { owner, num: projectNum });
    project = userData?.user?.projectV2;
  } catch { /* try org next */ }

  if (!project) {
    try {
      const orgData = await graphql(`
        query($owner: String!, $num: Int!) {
          organization(login: $owner) {
            projectV2(number: $num) {
              id
              fields(first: 30) {
                nodes {
                  ... on ProjectV2Field { id name dataType }
                }
              }
            }
          }
        }`, { owner, num: projectNum });
      project = orgData?.organization?.projectV2;
    } catch { /* not found */ }
  }

  if (!project) {
    console.log(`Project #${projectNum} not found for owner '${owner}'. Run setup-project.sh first.`);
    return;
  }

  const fieldMap = {};
  project.fields.nodes.forEach(f => { if (f?.name) fieldMap[f.name] = f.id; });

  // Add issue to project (idempotent — fails silently if already present)
  let itemId;
  try {
    const addResult = await graphql(`
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
          item { id }
        }
      }`, { projectId: project.id, contentId: issueNodeId });
    itemId = addResult.addProjectV2ItemById.item.id;
    console.log(`Added issue to project, item ID: ${itemId}`);
  } catch (err) {
    console.log(`Could not add issue to project: ${err.message}. It may already be there.`);
    // Try to find existing item
    const items = await graphql(`
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 200) {
              nodes { id content { ... on Issue { id } } }
            }
          }
        }
      }`, { projectId: project.id });
    const found = items.node.items.nodes.find(n => n.content?.id === issueNodeId);
    if (!found) {
      console.log('Issue not found in project and could not be added. Skipping field updates.');
      return;
    }
    itemId = found.id;
  }

  const scoreFields = {
    'Innovation Score':    evaluation.innovation,
    'Technical Score':     evaluation.technical_quality,
    'Documentation Score': evaluation.documentation,
    'Feasibility Score':   evaluation.feasibility,
    'Impact Score':        evaluation.impact,
    'Total Score': (
      evaluation.innovation + evaluation.technical_quality +
      evaluation.documentation + evaluation.feasibility + evaluation.impact
    )
  };

  for (const [fieldName, value] of Object.entries(scoreFields)) {
    const fieldId = fieldMap[fieldName];
    if (!fieldId) {
      console.log(`Field '${fieldName}' not in project. Run setup-project.sh to create it.`);
      continue;
    }
    await graphql(`
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: Float!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: { number: $value }
        }) { projectV2Item { id } }
      }`, { projectId: project.id, itemId, fieldId, value });
    console.log(`  ${fieldName} = ${value}`);
  }
  console.log('Project fields updated.');
}

main().catch(err => {
  // Non-fatal: evaluation comment already posted
  console.error('Project update failed (non-fatal):', err.message);
  process.exit(0);
});
