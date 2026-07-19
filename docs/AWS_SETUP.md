# AWS Setup (real Textract + Comprehend + Bedrock)

Skip this entirely if you're demoing in **mock mode** (`USE_MOCK=auto` with no
credentials, or `USE_MOCK=true`).

## 1. Choose a region

Use a region where **Amazon Bedrock + Claude Sonnet 4.5**, **Textract**, and
**Comprehend** are all available — e.g. `us-east-1`. The default Bedrock model id
is the **global cross-Region inference profile**, which routes to any supported
commercial region, so `us-east-1` is a safe home region.

## 2. Enable Bedrock model access

Claude models on Bedrock require you to request access **once** per account:

1. AWS Console → **Amazon Bedrock** → **Model access**.
2. Enable **Anthropic → Claude Sonnet 4.5**.
3. Wait until status shows **Access granted**.

> Claude Sonnet 4.5 must be invoked through an **inference profile**, not the bare
> model id. This project defaults to the global profile
> `global.anthropic.claude-sonnet-4-5-20250929-v1:0`. To pin to the US region
> profile instead, set `BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-5-20250929-v1:0`.

## 3. Create an IAM user/role with the right permissions

Attach a policy like this (scope down resources for production):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Textract",
      "Effect": "Allow",
      "Action": ["textract:AnalyzeDocument", "textract:DetectDocumentText"],
      "Resource": "*"
    },
    {
      "Sid": "Comprehend",
      "Effect": "Allow",
      "Action": [
        "comprehend:DetectEntities",
        "comprehend:DetectPiiEntities",
        "comprehend:DetectKeyPhrases",
        "comprehend:DetectSentiment",
        "comprehend:DetectDominantLanguage"
      ],
      "Resource": "*"
    },
    {
      "Sid": "BedrockInvoke",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0",
        "arn:aws:bedrock:*:*:inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0",
        "arn:aws:bedrock:*:*:inference-profile/*.anthropic.claude-sonnet-4-5-20250929-v1:0"
      ]
    }
  ]
}
```

> When you use an inference profile, Bedrock also needs permission to invoke the
> underlying foundation model in the destination region(s) — that's why the
> `foundation-model/...` ARN is included above.

## 4. Provide credentials to the pipeline

Put them in the project root `.env` (read automatically by `docker compose`):

```dotenv
USE_MOCK=false
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
# AWS_SESSION_TOKEN=...   # only for temporary/SSO credentials
BEDROCK_MODEL_ID=global.anthropic.claude-sonnet-4-5-20250929-v1:0
```

Then `docker compose up --build`. The processor will log
`Running in AWS mode - calling real Textract, Comprehend and Bedrock.`

## 5. Input format limits (Textract synchronous)

- Formats: **JPEG, PNG, PDF, TIFF**.
- **Single page**, **≤ 10 MB**.
- Multi-page or larger files require the asynchronous Textract APIs with an S3
  source (not wired into this demo — see `ARCHITECTURE.md` §7).

## 6. Cost & safety notes

- Textract, Comprehend, and Bedrock are **pay-per-use**. The seeded demo processes
  only 3 small documents, but be mindful when bulk-testing.
- Never commit `.env`; it's already in `.gitignore`.
- For production, prefer an **IAM role** (task role / instance profile) over
  long-lived access keys.

## 7. Quick credential test

```bash
aws sts get-caller-identity        # confirms credentials resolve
aws bedrock list-foundation-models --region us-east-1 --query "modelSummaries[?contains(modelId,'sonnet-4-5')].modelId"
```
