terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  required_version = ">= 1.0"
}

provider "aws" {
  region = var.aws_region
  # Credentials can be configured via environment variables, shared credentials file, or IAM roles.
  # access_key = var.aws_access_key
  # secret_key = var.aws_secret_key
}

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

# Example S3 bucket for Lambda code (optional, depending on deployment strategy)
resource "aws_s3_bucket" "lambda_bucket" {
  bucket = "agentic-ai-lambda-bucket-${random_id.bucket_suffix.hex}" # Ensure unique bucket name
  # acl    = "private" # ACLs are now deprecated in favor of bucket policies and IAM

  tags = {
    Name        = "LambdaCodeBucket"
    Environment = "Dev"
    Project     = "AgenticAI"
  }
}

resource "random_id" "bucket_suffix" {
  byte_length = 8
}

# IAM Role for Lambda Function
resource "aws_iam_role" "lambda_exec_role" {
  name = "agentic-ai-lambda-exec-role"

  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Action    = "sts:AssumeRole",
        Effect    = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "AgenticAILambdaRole"
  }
}

# IAM Policy for Lambda to access CloudWatch Logs
resource "aws_iam_policy" "lambda_logging_policy" {
  name        = "agentic-ai-lambda-logging-policy"
  description = "IAM policy for Lambda function to write logs to CloudWatch"

  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Effect   = "Allow",
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# Attach logging policy to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_logs_attach" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = aws_iam_policy.lambda_logging_policy.arn
}


# Placeholder for Lambda function for the AI service (Python)
# You would package your ai-services/generator.py and its dependencies into a zip file and upload to S3
/*
resource "aws_lambda_function" "ai_generator_lambda" {
  function_name = "agentic-ai-epic-generator"
  handler       = "generator.generate_epics" # Assuming your Python file is generator.py and function is generate_epics
  runtime       = "python3.9"
  role          = aws_iam_role.lambda_exec_role.arn

  # Option 1: Deploy from S3
  s3_bucket = aws_s3_bucket.lambda_bucket.id
  s3_key    = "ai_service.zip" # The name of your deployment package in S3

  # Option 2: Deploy from local archive (less common for CI/CD)
  # filename         = "path/to/your/ai_service.zip"
  # source_code_hash = filebase64sha256("path/to/your/ai_service.zip")

  environment {
    variables = {
      OPENAI_API_KEY = var.openai_api_key # Securely manage API keys, e.g., via Secrets Manager
    }
  }

  timeout     = 30 # seconds
  memory_size = 256 # MB

  tags = {
    Name    = "AIGeneratorLambda"
    Project = "AgenticAI"
  }
}
*/

# Placeholder for API Gateway to trigger the Lambda
/*
resource "aws_api_gateway_rest_api" "agentic_api" {
  name        = "AgenticAIApi"
  description = "API Gateway for the Agentic AI system"

  tags = {
    Name    = "AgenticAIApiGateway"
    Project = "AgenticAI"
  }
}

resource "aws_api_gateway_resource" "generate_resource" {
  rest_api_id = aws_api_gateway_rest_api.agentic_api.id
  parent_id   = aws_api_gateway_rest_api.agentic_api.root_resource_id
  path_part   = "generate" # This will be /generate
}

resource "aws_api_gateway_method" "generate_method_post" {
  rest_api_id   = aws_api_gateway_rest_api.agentic_api.id
  resource_id   = aws_api_gateway_resource.generate_resource.id
  http_method   = "POST"
  authorization = "NONE" # Consider adding authorization (e.g., API Key, IAM, Cognito)
}

resource "aws_api_gateway_integration" "lambda_integration_post" {
  rest_api_id = aws_api_gateway_rest_api.agentic_api.id
  resource_id = aws_api_gateway_resource.generate_resource.id
  http_method = aws_api_gateway_method.generate_method_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY" # For Lambda proxy integration
  uri                     = aws_lambda_function.ai_generator_lambda.invoke_arn
}

resource "aws_lambda_permission" "apigw_lambda_permission" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ai_generator_lambda.function_name
  principal     = "apigateway.amazonaws.com"

  # The ARN of the API Gateway method. Source ARN must be for the specific stage and method.
  # This is a bit tricky and often requires constructing the ARN carefully.
  # Example: arn:aws:execute-api:REGION:ACCOUNT_ID:API_ID/STAGE/METHOD/PATH
  source_arn = "${aws_api_gateway_rest_api.agentic_api.execution_arn}/*\/POST/generate"
}

resource "aws_api_gateway_deployment" "api_deployment" {
  depends_on = [
    aws_api_gateway_integration.lambda_integration_post,
    # Add other integrations if any
  ]

  rest_api_id = aws_api_gateway_rest_api.agentic_api.id
  stage_name  = "dev" # Or var.api_stage_name

  # Triggers redeployment when the configuration changes
  # This can be a more robust approach than just using triggers map with timestamp()
  # Consider using a more specific trigger, like the hash of the OpenAPI spec or relevant resource configurations.
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.generate_resource.id,
      aws_api_gateway_method.generate_method_post.id,
      aws_api_gateway_integration.lambda_integration_post.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

output "api_gateway_invoke_url" {
  description = "Base URL for API Gateway stage"
  value       = "${aws_api_gateway_deployment.api_deployment.invoke_url}/generate"
}
*/

# You would also need to define variables for sensitive data like openai_api_key
# It's recommended to use AWS Secrets Manager or Parameter Store for such secrets.
# variable "openai_api_key" {
#   description = "OpenAI API Key"
#   type        = string
#   sensitive   = true
# } 