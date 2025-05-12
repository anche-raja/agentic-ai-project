const path = require('path');
require('dotenv').config({ 
  path: path.resolve(__dirname, '../.env') 
});

const express = require('express');
// const githubService = require('./githubService'); // No longer needed
const jiraService = require('./jiraService'); // Import Jira service
const { spawn } = require('child_process');
// const { generateEpics } = require('../ai-services/generator'); // This would be more complex to call Python from Node directly
const { execSync } = require('child_process');

const app = express();
app.use(express.json());

// Temporary debug line in server.js
console.log('Loaded ENV:', process.env.GITHUB_TOKEN ? 'Yes' : 'No');
console.log('Resolved .env path:', path.resolve(__dirname, '../.env'));

// Add detailed startup logs
console.log('✅ Environment Variables:');
console.log(`- GITHUB_TOKEN: ${process.env.GITHUB_TOKEN ? '*****' : 'MISSING'}`);
console.log(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '*****' : 'MISSING'}`);
console.log(`- Python Path: ${process.env.PYTHONPATH || 'Default'}`);

// Add after dotenv config
const requiredEnvVars = [
  // 'GITHUB_TOKEN', // No longer required for issue tracking
  'OPENAI_API_KEY',
  'JIRA_BASE_URL',
  'JIRA_USERNAME',
  'JIRA_API_TOKEN',
  'JIRA_PROJECT_KEY'
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(v => console.error(` - ${v}`));
  process.exit(1);
}

try {
  jiraService.initializeJira(); // Initialize Jira client at startup
} catch (e) {
  console.error('❌ Failed to initialize Jira client:', e.message);
  process.exit(1);
}

// Verify Python executable
try {
  execSync('python3 --version');
} catch (e) {
  console.error('❌ Python3 not found in PATH');
  process.exit(1);
}

// After environment validation
// const { initializeGitHub } = require('./githubService'); // No longer needed
// initializeGitHub(); // No longer needed

// AI Generation endpoint
app.post('/generate', async (req, res) => {
  const { projectDescription } = req.body;
  const jiraProjectKey = process.env.JIRA_PROJECT_KEY;
  
  console.log("Received project description:", projectDescription);
  console.log("Target Jira Project Key (from .env):", jiraProjectKey);

  if (!jiraProjectKey) {
    console.error('❌ JIRA_PROJECT_KEY is not set in the environment variables.');
    return res.status(500).json({ message: "Server configuration error: JIRA_PROJECT_KEY is not set." });
  }

  try {
    console.log("Calling AI service...");
    const pythonProcess = spawn('../ai-services/.venv/bin/python', [
      '../ai-services/generator.py', 
      projectDescription
    ], {
      env: {
        ...process.env,
        PYTHONPATH: '../ai-services/.venv/lib/python3.9/site-packages'
      },
      timeout: 30000  // 30 seconds
    });

    let aiOutput = '';
    pythonProcess.stdout.on('data', (data) => {
      aiOutput += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python Error: ${data}`);
    });

    pythonProcess.on('close', async (code) => {
      if (code !== 0) {
        return res.status(500).json({ 
          message: "AI service failed",
          error: aiOutput 
        });
      }

      try {
        const artifacts = JSON.parse(aiOutput);
        
        if (artifacts.error) {
          throw new Error(artifacts.error);
        }

        // Proceed with Jira integration
        const results = await jiraService.createArtifactsInJira(jiraProjectKey, artifacts);
        res.json({ 
          message: "Successfully generated and created issues in Jira",
          createdIssues: results, // These will be Jira issue objects
          artifacts 
        });

      } catch (error) {
        console.error("AI Parse Error:", error);
        res.status(500).json({
          message: "Failed to parse AI response",
          error: error.message
        });
      }
    });

    pythonProcess.on('error', (err) => {
      console.error('Python process failed:', err);
      res.status(500).json({
        message: "AI service startup failed",
        error: err.message
      });
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ message: "Error processing request", error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 