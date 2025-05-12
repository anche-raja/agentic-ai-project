const JiraClient = require('jira-client');

let jira;

function initializeJira() {
  if (!process.env.JIRA_BASE_URL || !process.env.JIRA_USERNAME || !process.env.JIRA_API_TOKEN) {
    throw new Error('Jira environment variables (JIRA_BASE_URL, JIRA_USERNAME, JIRA_API_TOKEN) are required');
  }

  jira = new JiraClient({
    protocol: 'https',
    host: process.env.JIRA_BASE_URL.replace('https://', '').replace('http://', ''), // host expects just the domain
    username: process.env.JIRA_USERNAME,
    password: process.env.JIRA_API_TOKEN, // In jira-client, password is used for API token
    apiVersion: '2',
    strictSSL: true
  });
  console.log('Jira client initialized.');
}

async function getProjectIssueTypes(projectKey) {
  try {
    const project = await jira.getProject(projectKey);
    // console.log('Project details:', project);
    if (project && project.issueTypes) {
      return project.issueTypes.map(it => ({ id: it.id, name: it.name.toLowerCase() }));
    }
    return [];
  } catch (error) {
    console.error(`Error fetching project issue types for ${projectKey}:`, error.message || error);
    throw new Error(`Could not fetch issue types for project ${projectKey}. Ensure project exists and credentials are correct.`);
  }
}

async function createIssueInJira(projectKey, summary, description, issueTypeNameOrId, parentEpicKey) {
  const issuePayload = {
    fields: {
      project: {
        key: projectKey
      },
      summary: summary,
      description: description,
      issuetype: {
        name: issueTypeNameOrId
      }
    }
  };

  // Use 'parent' field for linking to Epic if issue is Story, Task, or Bug
  // This is common for Team-managed projects or if Epic Link custom field is not used/found.
  if (parentEpicKey && (issueTypeNameOrId.toLowerCase() === 'story' || issueTypeNameOrId.toLowerCase() === 'task' || issueTypeNameOrId.toLowerCase() === 'bug')) {
    issuePayload.fields.parent = { key: parentEpicKey };
  }
  
  // The old epicLinkCfId logic is removed from here as we now directly use 'parent' based on issue type.
  // If you had a specific custom field for Epic Link (e.g., for company-managed projects)
  // and it was different from 'parent', the logic would need to be conditional or use that specific ID.

  try {
    const issue = await jira.addNewIssue(issuePayload);
    console.log(`Created Jira Issue: ${issue.key} - ${summary}`);
    return issue;
  } catch (error) {
    console.error(`Failed to create Jira issue '${summary}':`, error.message || error.errorMessages || error);
    // Log the full error object if it helps, as jira-client errors can be nested
    // console.error('Full Jira error:', JSON.stringify(error, null, 2));
    throw error; // Re-throw to be caught by the caller
  }
}

async function findEpicLinkCfId() {
    // This function may no longer be strictly needed if we consistently use the 'parent' field for linking to epics.
    // However, keeping it for now in case some Jira setups still rely on a specific custom field for Epic Link
    // that isn't the standard 'parent' field, especially in some company-managed project configurations.
    // For now, it can return null or a known non-interfering value if 'parent' is the primary mechanism.
    console.warn("Attempting to use 'parent' field for Epic linking. The findEpicLinkCfId function might be obsolete or need review for your specific Jira project type (Team-managed vs Company-managed).");
    return null; // Or a specific custom field ID if you identify one and it's NOT 'parent'
}


async function createArtifactsInJira(jiraProjectKey, artifacts) {
  if (!jira) {
    initializeJira();
  }

  if (!jiraProjectKey) {
    throw new Error('Jira Project Key is required.');
  }
  if (!artifacts || !artifacts.epics || !Array.isArray(artifacts.epics)) {
    throw new Error('Invalid artifacts structure: Epics array is missing or not an array.');
  }

  const createdIssues = [];
  // const epicLinkCfId = await findEpicLinkCfId(); // We will use parentEpicKey directly now

  for (const epic of artifacts.epics) {
    try {
      // Epics themselves do not have a parent Epic link in this context
      const epicIssue = await createIssueInJira(jiraProjectKey, `[EPIC] ${epic.title}`, epic.description, 'Epic');
      createdIssues.push(epicIssue);

      if (epic.stories && Array.isArray(epic.stories)) {
        for (const story of epic.stories) {
          let storyDescription = story.description || epic.description; 
          storyDescription += `\n\nAcceptance Criteria:\n${story.acceptance_criteria ? story.acceptance_criteria.join('\n- ') : 'Not defined'}`;
          
          // Pass epicIssue.key as the parentEpicKey for stories
          const storyIssue = await createIssueInJira(jiraProjectKey, story.title, storyDescription, 'Story', epicIssue.key);
          createdIssues.push(storyIssue);

          if (story.tasks && Array.isArray(story.tasks) && story.tasks.length > 0) {
            for (const task of story.tasks) {
              const taskTitle = task.title || 'Untitled Task';
              // Tasks linked to the story. If tasks can be directly under epics, pass epicIssue.key
              // Assuming tasks here are children of stories. For sub-tasks, issue type should be 'Sub-task'.
              // If linking to story as parent (for sub-tasks):
              // const taskIssue = await createIssueInJira(jiraProjectKey, taskTitle, task.description || taskTitle, 'Sub-task', storyIssue.key);
              // For now, linking tasks as children of the Epic (like stories) for simplicity, using 'Task' type:
              const taskIssue = await createIssueInJira(jiraProjectKey, taskTitle, task.description || taskTitle, 'Task', epicIssue.key);
              createdIssues.push(taskIssue);
            }
          }

          if (story.bugs && Array.isArray(story.bugs) && story.bugs.length > 0) {
            for (const bug of story.bugs) {
              const bugTitle = bug.title || 'Untitled Bug';
              const bugDescription = `${bug.description || 'No description provided.'}\n\nSteps to Reproduce:\n${bug.steps_to_reproduce || 'Not provided'}\n\nSeverity: ${bug.severity || 'Medium'}`;
              // Bugs linked to the story. If bugs can be directly under epics, pass epicIssue.key
              // Assuming bugs here are related to stories.
              // Linking bug to the epic for now, like tasks and stories:
              const bugIssue = await createIssueInJira(jiraProjectKey, bugTitle, bugDescription, 'Bug', epicIssue.key); 
              createdIssues.push(bugIssue);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error processing epic '${epic.title}' or its children:`, error.message || error);
      // Decide if one epic failing should stop all, or collect errors
      // For now, we continue with other epics if one fails.
    }
  }
  return createdIssues;
}

module.exports = { initializeJira, createArtifactsInJira }; 