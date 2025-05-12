# Agentic AI Project Generator

This project is an AI-augmented system designed to take a project description and generate Agile artifacts such as epics, user stories, tasks, and potential bugs. It then automatically creates these items in a specified Jira project.

## Tech Stack

-   **Frontend**: Next.js, React, TypeScript, Tailwind CSS
-   **Backend**: Node.js, Express.js
-   **AI Service**: Python, LangChain, OpenAI API
-   **Issue Tracking Integration**: Jira API

## Prerequisites

-   Node.js (v18 or newer recommended)
-   npm (comes with Node.js) or yarn
-   Python (v3.9 or newer recommended)
-   An active OpenAI API key.
-   A Jira instance (Cloud or Server) with:
    -   Your Jira Base URL (e.g., `https://your-company.atlassian.net`)
    -   Your Jira Username (email)
    -   A Jira API Token
    -   The Project Key of the Jira project where issues will be created.

## Project Structure

```
agentic-ai-project/
├── ai-services/        # Python scripts for AI generation with OpenAI & LangChain
│   ├── .venv/          # Python virtual environment (gitignored)
│   ├── generator.py
│   └── requirements.txt
├── backend/            # Node.js Express server for API and Jira integration
│   ├── node_modules/   # (gitignored)
│   ├── server.js
│   ├── jiraService.js
│   └── package.json
├── frontend/           # Next.js frontend application
│   ├── node_modules/   # (gitignored)
│   ├── src/
│   ├── public/
│   ├── next.config.mjs
│   └── package.json
├── .env                # Local environment variables (gitignored, create from .env.example)
├── .env.example        # Example environment variables template
├── .gitignore
└── README.md
```

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd agentic-ai-project
    ```

2.  **Create and configure environment variables:**
    -   Copy `.env.example` to a new file named `.env` in the project root: `cp .env.example .env`
    -   Edit the `.env` file and fill in your actual credentials:
        ```env
        OPENAI_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        JIRA_BASE_URL="https://your-company.atlassian.net"
        JIRA_USERNAME="your_jira_email@example.com"
        JIRA_API_TOKEN="yourJiraApiTokenGeneratedFromAtlassian"
        JIRA_PROJECT_KEY="YOURPROJECTKEY"
        ```

3.  **Setup Backend:**
    ```bash
    cd backend
    npm install
    cd ..
    ```

4.  **Setup AI Service (Python):**
    ```bash
    cd ai-services
    python3 -m venv .venv 
    source .venv/bin/activate   # On macOS/Linux
    # .\.venv\Scripts\activate    # On Windows
    pip install -r requirements.txt
    deactivate                  # Optional: deactivate for now
    cd ..
    ```

5.  **Setup Frontend:**
    ```bash
    cd frontend
    npm install
    cd ..
    ```

## Running the Application

1.  **Start the Backend Server:**
    Open a terminal, navigate to the backend directory, and run:
    ```bash
    cd agentic-ai-project/backend
    node server.js
    ```
    The backend server will run on `http://localhost:3001` by default.

2.  **Start the Frontend Development Server:**
    Open another terminal, navigate to the frontend directory, and run:
    ```bash
    cd agentic-ai-project/frontend
    npm run dev
    ```
    The frontend will be accessible at `http://localhost:3000`.

3.  **Access the Application:**
    Open your web browser and go to `http://localhost:3000`.

## Important Jira Configuration Note

For stories to be correctly linked to epics in Jira, the `jiraService.js` file (`agentic-ai-project/backend/jiraService.js`) uses a function `findEpicLinkCfId()` or directly uses the `parent` field.

-   If your Jira project is **Team-managed**, it likely uses the `parent` field for linking, and the current `jiraService.js` (as of recent updates) attempts this.
-   If your Jira project is **Company-managed**, it typically uses a specific custom field for "Epic Link". You **MUST** find the correct ID for this field (e.g., `customfield_10021`) in your Jira instance and update it in `jiraService.js` if the `parent` field approach doesn't work. See comments in `jiraService.js` and previous discussions on how to find this ID.

Failure to configure this correctly will result in epics being created, but stories and other child issues might not be linked or might fail to create.

## Troubleshooting

-   **`EADDRINUSE` error for backend:** Means port 3001 is already in use. Stop the existing process using that port (e.g., `lsof -i :3001` then `kill -9 <PID>` on macOS/Linux) and restart the backend.
-   **Frontend shows "Failed to proxy" or JSON parsing errors:** This almost always means the backend server is not running correctly or is not reachable at `http://localhost:3001`. Ensure the backend is started without errors from the `agentic-ai-project/backend` directory.
-   **Jira issues not created / errors from Jira service:**
    -   Double-check all `JIRA_*` environment variables in your `.env` file.
    -   Verify the Jira Project Key.
    -   Ensure the user associated with `JIRA_API_TOKEN` has permissions to create/edit issues in the target project.
    -   Verify the "Epic Link" custom field ID or `parent` field usage in `jiraService.js` as per your Jira project type.
