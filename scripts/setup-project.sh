#!/usr/bin/env bash
# scripts/setup-project.sh
# Creates a GitHub Projects v2 board with all required scoring fields via GraphQL.
# Requires: gh CLI authenticated with project:write scope (use PROJECT_TOKEN if needed).
# Usage: PROJECT_NAME="Hackathon Judging Board" bash scripts/setup-project.sh

set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-Hackathon Judging Board}"
REPO="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q '.nameWithOwner')}"
OWNER="${REPO%%/*}"

echo "Creating project '${PROJECT_NAME}' for owner '${OWNER}'..."

# Resolve the owner's node ID (works for both users and orgs)
OWNER_ID=$(gh api graphql -f query='
  query($login: String!) {
    repositoryOwner(login: $login) { id }
  }
' -f login="$OWNER" --jq '.data.repositoryOwner.id')

echo "Owner node ID: $OWNER_ID"

# Create the project
PROJECT_DATA=$(gh api graphql -f query='
  mutation($ownerId: ID!, $title: String!) {
    createProjectV2(input: {ownerId: $ownerId, title: $title}) {
      projectV2 { id number url }
    }
  }
' -f ownerId="$OWNER_ID" -f title="$PROJECT_NAME")

PROJECT_ID=$(echo "$PROJECT_DATA" | jq -r '.data.createProjectV2.projectV2.id')
PROJECT_NUMBER=$(echo "$PROJECT_DATA" | jq -r '.data.createProjectV2.projectV2.number')
PROJECT_URL=$(echo "$PROJECT_DATA" | jq -r '.data.createProjectV2.projectV2.url')

echo "Project created: $PROJECT_URL"
echo "Project ID: $PROJECT_ID"
echo "Project Number: $PROJECT_NUMBER"

# Create number fields for each scoring dimension
SCORE_FIELDS=("Innovation Score" "Technical Score" "Documentation Score" "Feasibility Score" "Impact Score" "Total Score")

for FIELD_NAME in "${SCORE_FIELDS[@]}"; do
  RESULT=$(gh api graphql -f query='
    mutation($projectId: ID!, $name: String!) {
      createProjectV2Field(input: {
        projectId: $projectId,
        name: $name,
        dataType: NUMBER
      }) {
        projectV2Field {
          ... on ProjectV2Field { id name }
        }
      }
    }
  ' -f projectId="$PROJECT_ID" -f name="$FIELD_NAME" 2>&1) || true
  echo "  Field: $FIELD_NAME"
done

# Create Evaluation Status single-select field
gh api graphql -f query='
  mutation($projectId: ID!) {
    createProjectV2Field(input: {
      projectId: $projectId,
      name: "Evaluation Status",
      dataType: SINGLE_SELECT,
      singleSelectOptions: [
        {name: "Pending",    color: GRAY,   description: "Not yet evaluated"},
        {name: "Evaluating", color: YELLOW, description: "AI evaluation in progress"},
        {name: "Evaluated",  color: GREEN,  description: "Scores posted"},
        {name: "Finalist",   color: PURPLE, description: "Selected as finalist"},
        {name: "Winner",     color: BLUE,   description: "Selected as winner"}
      ]
    }) {
      projectV2Field {
        ... on ProjectV2SingleSelectField { id name }
      }
    }
  }
' -f projectId="$PROJECT_ID" > /dev/null
echo "  Field: Evaluation Status (single-select)"

# Create Submission Type single-select field
gh api graphql -f query='
  mutation($projectId: ID!) {
    createProjectV2Field(input: {
      projectId: $projectId,
      name: "Submission Type",
      dataType: SINGLE_SELECT,
      singleSelectOptions: [
        {name: "Challenge", color: BLUE,   description: "A posted challenge"},
        {name: "Idea",      color: YELLOW, description: "An idea submission"},
        {name: "Solution",  color: RED,    description: "A final solution"}
      ]
    }) {
      projectV2Field {
        ... on ProjectV2SingleSelectField { id name }
      }
    }
  }
' -f projectId="$PROJECT_ID" > /dev/null
echo "  Field: Submission Type (single-select)"

echo ""
echo "============================================"
echo "IMPORTANT: Add the following as a repository"
echo "variable in Settings > Secrets and Variables"
echo "> Actions > Variables:"
echo ""
echo "  Name:  PROJECT_NUMBER"
echo "  Value: $PROJECT_NUMBER"
echo "============================================"
