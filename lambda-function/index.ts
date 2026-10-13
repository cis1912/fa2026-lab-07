import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Every Lambda function needs an execution role -- permission for the
// Lambda service to run code on your behalf. This part is just plumbing
// AWS requires; it's written for you so you can focus on the function
// itself below.
const lambdaRole = new aws.iam.Role("lambdaRole", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Effect: "Allow",
        Principal: {
          Service: "lambda.amazonaws.com",
        },
      },
    ],
  }),
});

const lambdaLogsPolicy = new aws.iam.RolePolicyAttachment("lambdaLogsPolicy", {
  role: lambdaRole.name,
  policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
});

// This is the function itself. Its code lives in ./lambda -- Pulumi will
// zip that directory up and upload it as the deployment package.
//
// TODO: fill in the three blanks below.
const flagFunction = new aws.lambda.Function("flagFunction", {
  runtime: <FILL_IN>,
  code: <FILL_IN>,
  handler: <FILL_IN>,
  role: lambdaRole.arn,
  environment: {
    variables: {
      FLAG: "functions-are-serverless",
    },
  },
});

// Stack outputs: values you can read back later with
// `pulumi stack output <name>` instead of re-reading this file.
export const functionName = flagFunction.name;
