const { Octokit } = require('@octokit/rest');

let octokit;

function initializeGitHub() {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }
  
  octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
    userAgent: 'AgenticAI/v1.0',
    log: {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error
    }
  });
}

async function createIssues(repoDetails, artifacts) {
  // Ensure GITHUB_TOKEN is set in your environment variables
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  if (!repoDetails || !repoDetails.owner || !repoDetails.name) {
    console.error('Repository owner and name are required.');
    throw new Error('Repository owner and name are required.');
  }

  if (!artifacts || !artifacts.epics || !Array.isArray(artifacts.epics)) {
    console.error('Invalid artifacts structure.');
    throw new Error('Invalid artifacts structure: Epics array is missing or not an array.');
  }

  console.log(`Creating issues in ${repoDetails.owner}/${repoDetails.name}`)
  const issuePromises = [];

  for (const epic of artifacts.epics) {
    // Create Epic issue
    issuePromises.push(
      octokit.issues.create({
        owner: repoDetails.owner,
        repo: repoDetails.name,
        title: `[EPIC] ${epic.title}`,
        body: epic.description,
        labels: ['epic'] // Optional: add a label
      }).then(response => {
        console.log(`Created Epic: ${response.data.html_url}`);
        return response.data;
      }).catch(error => {
        console.error(`Failed to create Epic '${epic.title}':`, error.message);
        // Decide if you want to throw the error or just log it and continue
        // throw error; 
      })
    );

    if (epic.stories && Array.isArray(epic.stories)) {
      for (const story of epic.stories) {
        // Create Story issue
        let storyBody = `Associated Epic: ${epic.title}\n\nAcceptance Criteria:\n${story.acceptance_criteria ? story.acceptance_criteria.join('\n- ') : 'Not defined'}`;

        if (story.tasks && Array.isArray(story.tasks) && story.tasks.length > 0) {
          storyBody += '\n\n### Tasks\n';
          story.tasks.forEach(task => {
            // Ensure task.title is not undefined or null before using it
            const taskTitle = task && task.title ? task.title : 'Untitled Task';
            storyBody += `- [ ] ${taskTitle}\n`;
          });
        }

        issuePromises.push(
          octokit.issues.create({
            owner: repoDetails.owner,
            repo: repoDetails.name,
            title: story.title, 
            body: storyBody, // Use the updated body with tasks
            labels: ['story'] // Optional: add a label
          }).then(response => {
            console.log(`Created Story: ${response.data.html_url}`);
            return response.data;
          }).catch(error => {
            console.error(`Failed to create Story '${story.title}':`, error.message);
            // Decide if you want to throw the error or just log it and continue
            // throw error;
          })
        );
      }
    }
  }
  // Use Promise.allSettled to wait for all promises to settle (either resolve or reject)
  const results = await Promise.allSettled(issuePromises);
  
  // Log results for debugging
  results.forEach(result => {
    if (result.status === 'rejected') {
      console.error('An issue creation failed:', result.reason?.message || result.reason);
    }
  });

  return results.filter(result => result.status === 'fulfilled').map(result => result.value);
}

module.exports = { createIssues, initializeGitHub };

// Example usage (for testing this module directly):
/*
async function test() {
  if (!process.env.GITHUB_TOKEN) {
    console.error("GITHUB_TOKEN environment variable is not set.");
    return;
  }
  const sampleRepo = { owner: "YOUR_GITHUB_USERNAME", name: "YOUR_TEST_REPO" }; // Replace with your details
  const sampleArtifacts = {
    epics: [
      {
        title: "Test Epic from Service",
        description: "This is a test epic created by the githubService.js module.",
        stories: [
          {
            title: "Test Story 1 for Service Epic",
            acceptance_criteria: ["Criterion X", "Criterion Y"]
          }
        ]
      }
    ]
  };

  try {
    const createdIssues = await createIssues(sampleRepo, sampleArtifacts);
    console.log("Successfully created issues:", createdIssues.length);
  } catch (error) {
    console.error("Error during test execution:", error);
  }
}

// To test: ensure GITHUB_TOKEN is set, then run node agentic-ai-project/backend/githubService.js
// test(); 
*/ 