from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
# You'll need to install langchain and openai: pip install langchain openai
# from langchain_openai import OpenAI # Old LLM import
from langchain_openai import ChatOpenAI # New ChatModel import
from dotenv import load_dotenv
from pathlib import Path
import os
import sys # Import sys to access command-line arguments
import json # Import json

# Load environment variables from project root
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Placeholder for actual LLM initialization (e.g., OpenAI)
# For now, we'll simulate the LLM response for structure.
# llm = OpenAI(openai_api_key=os.environ.get("OPENAI_API_KEY")) 

EPIC_TEMPLATE = '''
As a project manager, convert this project description into Agile artifacts following a structure similar to Jira (Epics > Stories > Tasks > Bugs).
{description}

Output format (JSON only, no other text or markdown):
{{
  "epics": [
    {{
      "title": "Epic title",
      "description": "Epic description",
      "stories": [
        {{
          "title": "User story title",
          "acceptance_criteria": ["Criteria 1", "Criteria 2"],
          "tasks": [
            {{ "title": "Task 1 for story" }},
            {{ "title": "Task 2 for story" }}
          ],
          "bugs": [
            {{ "title": "Potential bug related to this story", "description": "Description of the bug...", "steps_to_reproduce": "1. Do X\n2. Do Y\n3. See error Z", "severity": "Medium" }}
          ]
        }}
      ]
    }}
  ]
}}
'''

def generate_epics(description: str) -> dict:
    """Generates epics and stories from a project description."""
    llm = ChatOpenAI(
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        model_name="gpt-4-turbo", # Using the latest GA GPT-4 Turbo model
        temperature=0.7,
        max_tokens=2048
    )

    prompt_template = PromptTemplate(template=EPIC_TEMPLATE, input_variables=["description"])
    
    chain = prompt_template | llm
    
    response_message = chain.invoke({"description": description})
    raw_output = response_message.content

    # Attempt to extract JSON from the raw output
    # Handles cases where LLM wraps JSON in markdown or adds extra text
    try:
        # Find the start of the JSON object
        json_start_index = raw_output.find('{')
        # Find the end of the JSON object (search from the end of the string)
        json_end_index = raw_output.rfind('}')
        
        if json_start_index != -1 and json_end_index != -1 and json_end_index > json_start_index:
            result_str = raw_output[json_start_index : json_end_index+1]
        else:
            # If no clear JSON object is found, pass the raw output (might still fail)
            result_str = raw_output 

    except AttributeError: # Should not happen if raw_output is a string
        result_str = raw_output

    try:
        return json.loads(result_str)
    except json.JSONDecodeError as e:
        # Handle cases where the LLM output isn't valid JSON
        # You might want to log this error and return a specific error structure
        # For now, re-raising or returning an error message:
        print(f"Error decoding LLM JSON output: {e}", file=sys.stderr)
        print(f"LLM Output was: {result_str}", file=sys.stderr)
        # Fallback to sample data or raise an error to be caught by the backend
        # This ensures the Python script doesn't crash the backend if JSON is malformed.
        # Option 1: Raise an error that the backend can catch and report
        raise ValueError(f"LLM output was not valid JSON: {result_str[:100]}...")
        # Option 2: Return an error structure (less ideal if backend expects specific format for success)
        # return {"error": "LLM output was not valid JSON", "details": result_str}

if __name__ == '__main__':
    if len(sys.argv) > 1:
        project_description_from_arg = sys.argv[1]
    else:
        # Fallback or error if no argument is provided, for direct testing
        # For now, let's use a default if no arg is passed when run directly for testing
        project_description_from_arg = "A default project description if no argument is passed."
        # Consider printing to stderr for direct runs without args:
        # print("Usage: python generator.py \\"<project_description>\\"", file=sys.stderr)
        # sys.exit(1) 

    artifacts = generate_epics(project_description_from_arg)
    print(json.dumps(artifacts, indent=2)) # This should be the only print to stdout 