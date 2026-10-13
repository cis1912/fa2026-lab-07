# Lab 07: Functions

So far, everything you've deployed has been _infrastructure that keeps running_: a container in Lab 01, a multi-container app in Lab 02, Pods and Services in the Kubernetes lab, a Helm-managed deployment in Lab 05, a VPC and S3 bucket in Lab 06. Once that infrastructure exists, it sits there -- using resources, costing money -- whether or not anyone is actually using it.

But a lot of real workloads aren't like that. They're small pieces of code that only need to run _in response to something_ -- an HTTP request, a file upload, a scheduled timer -- and can disappear completely in between. That's the idea behind **serverless functions** (also called FaaS, "Functions as a Service"): you give the cloud provider your code, and it worries about _where_ and _when_ to run it. You're not managing a server at all -- there's nothing to patch, nothing idling, nothing to SSH into.

In this lab you'll deploy your first serverless function: an **AWS Lambda** function. And instead of clicking through the AWS console or writing one-off `aws` CLI commands, you'll describe it as code using **[Pulumi](https://www.pulumi.com/)** -- an infrastructure-as-code tool that works a lot like Terraform from Lab 06 (same core idea: describe the infrastructure you want, Pulumi figures out the dependency graph and makes it so), except your infrastructure is written in a real programming language instead of HCL. We'll use TypeScript here.

## Setup

**1. Install the Pulumi CLI.**

```bash
brew install pulumi
pulumi version
```

**2. Confirm you have Node.js 18 or later.**

```bash
node --version
```

If you don't have Node installed (or it's too old), install it with `brew install node`.

**3. Confirm you have the AWS CLI.**

```bash
aws --version
```

If you don't have it: `brew install awscli`.

**4. Configure your AWS credentials.**

You should have received AWS credentials for this course -- check your inbox. Configure them under a _named profile_ (not your default profile) called `cis1912-student`:

```bash
aws configure --profile cis1912-student
```

When prompted, enter your access key, secret key, and set the default region to `us-east-1`.

For the rest of this lab, set this profile for your shell session so you don't have to pass `--profile` on every command:

```bash
export AWS_PROFILE=cis1912-student
```

> **Heads up:** that `export` only lasts for your current terminal session. If you open a new tab, you'll need to run it again.

Verify your credentials work:

```bash
aws sts get-caller-identity
```

You should see your account ID and IAM user ARN printed back.

**5. Log in to Pulumi -- locally.**

Pulumi needs somewhere to keep track of what it's deployed, the same way Terraform kept a `terraform.tfstate` file in Lab 06. By default, Pulumi stores that state in **Pulumi Cloud**, a hosted service -- which would mean signing up for an account. We don't need that for this lab: Pulumi can just as easily keep its state as files on your own machine.

```bash
pulumi login --local
```

This logs you in to the _local_ backend, which keeps state under `~/.pulumi` instead of sending it anywhere. **You do not need a Pulumi Cloud account for this lab.**

Verify it worked:

```bash
pulumi about
```

You should see the backend listed as a `file://` URL pointing into your home directory.

## Part A -- Your first Pulumi project

Pulumi organizes things into three concepts you'll keep running into:

- A **project** is the app as a whole -- described by `Pulumi.yaml`. We've already written this one for you.
- A **program** is the actual code that declares what infrastructure should exist -- `index.ts` in this lab.
- A **stack** is one independently-deployed instance of a project. You could have a `dev` stack and a `prod` stack of the same project, each with its own resources and its own state.

Move into the project directory and install its dependencies:

```bash
cd lambda-function
npm install
```

Now create your stack:

```bash
pulumi stack init dev
```

And tell Pulumi which AWS region to use:

```bash
pulumi config set aws:region us-east-1
```

Take a look at the files in this directory. `Pulumi.yaml` is the project manifest we shipped you. `Pulumi.dev.yaml` is new -- Pulumi just generated it to hold your stack's config (like the region you just set). That's a similar split to Terraform's `.tf` files vs. `terraform.tfstate`, except this one is config, not state.

## Part B -- Define the function

Open `index.ts` and read through it. It declares two things:

1. An **IAM role** (plus a policy attachment) that lets the Lambda service run code on your behalf and write its logs to CloudWatch. AWS requires every Lambda function to have one of these -- it's just plumbing, so this part is already written for you.
2. The **Lambda function** itself, which runs as that role and reads its code from `./lambda`.

There are three `<FILL_IN>` blanks for you to fill in, all on the function itself:

- Which Node.js runtime should the function run on?
- How should Pulumi package up the code in `./lambda`? (Hint: look at `pulumi.asset`.)
- What's the handler string -- "`<file>`.`<exported function name>`" -- for the code in `./lambda/index.js`?

Once you've filled them in, take a look at `./lambda/index.js` -- that's the actual function code that gets uploaded and run. Notice that it reads a `FLAG` environment variable, which `index.ts` already wires up for you.

One thing to notice: nowhere in `index.ts` did you have to write an explicit "the function depends on the role" instruction. Pulumi figured that out on its own, just from the fact that `flagFunction`'s `role` field references `lambdaRole.arn`. Keep that in mind for the Reflection questions below.

## Part C -- Deploy and invoke it

Preview what Pulumi is about to do:

```bash
pulumi preview
```

Read through the plan -- it should show one role, one policy attachment, and one function being created. Once you're happy with it, deploy:

```bash
pulumi up
```

Confirm when prompted. Once it finishes, grab the name of the function it created:

```bash
pulumi stack output functionName
```

Now invoke it:

```bash
aws lambda invoke \
  --function-name $(pulumi stack output functionName) \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  response.json

cat response.json
```

You should see a JSON body with a `flag` field in it.

Finally, go look at the function's logs -- either in the CloudWatch Logs console, or with:

```bash
aws logs tail /aws/lambda/$(pulumi stack output functionName) --since 10m
```

You should see the `console.log` line from the handler. The function itself only ran for a fraction of a second and then stopped existing -- but its logs stuck around.

## Reflection

Take a moment to think about (no need to write anything down, but you should be able to answer if asked):

- Where did your code "live" between invocations? Compare that to the always-on container from Lab 01/02, or the VPC from Lab 06.
- Why didn't you need an explicit `depends_on` between the role and the function, the way Terraform needed one between the S3 bucket and its policy in Lab 06?
- Where is Pulumi's state stored right now? How is that different from where `terraform.tfstate` lived in Lab 06?
- What would change about your workflow if you'd run `pulumi login` without `--local`?

## Tips

- If `pulumi up` succeeds but your first `aws lambda invoke` fails with something like `InvalidParameterValueException: The role defined for the function cannot be assumed by Lambda`, that's IAM eventual consistency -- the role hasn't fully propagated yet. Wait a few seconds and try again.
- Remember to clean up when you're done: `pulumi destroy` tears down everything the stack created. Run `pulumi stack rm` afterward if you want to remove the stack entirely.
- Never commit your AWS credentials, or a `Pulumi.<stack>.yaml` file that happens to contain secrets.
- `pulumi stack output <name>` is usually faster than re-reading your own code to find a deployed resource's name or ARN.
