# tic-tac-toe-full-stack-aws

A Serverless Web Game with Authentication and Score Tracking.

A fully serverless web-based game where users must sign in to play. Their scores are tracked and stored using AWS services. The project includes frontend and backend pipelines, along with infrastructure-as-code (IaC) to provision all necessary resources.

---

### Tech Stack

#### Frontend
- Framework: **ReactJS**
- Hosted on **Amazon S3** with **CloudFront** CDN.

#### Backend
- Language: Node.js
- **AWS Lambda** functions for game logic and APIs.
- **API Gateway** to expose Lambda endpoints.
- **Amazon Cognito** for authentication.
- **Amazon DynamoDB** to store user scores.
- **SNS / SQS** (if needed for messaging/notifications).

- [Backend ReadMe](./backend/ReadMe.md)

## Infrastructure as Code (IaC)
- Provisioned using **AWS CloudFormation**
- Templates define:
  - S3 buckets
  - Lambda functions
  - API Gateway
  - Cognito user pool and identity pool
  - DynamoDB table
  - IAM roles and policies
  - CloudFront distribution
---

## 🔁 CI/CD with CodePipeline

### Frontend Pipeline:
- Source: GitHub or CodeCommit
- Build: CodeBuild compiles frontend (e.g. React/Vite)
- Deploy: Outputs to S3 bucket

---

## Local Setup and testing

First clone it to your local machine by running

```
https://github.com/magicmarie/TicTacToe-game.git
```

Then install all the necessary dependencies

```
cd TicTacToe-game
bundle install
```

## Starting/running the application

```
npm run dev
```
