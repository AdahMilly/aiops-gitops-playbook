# DevOps-AIOps-GitOps-Playbook

# Dockerization and CI/CD

This project follows cloud-native best practices by using Docker for containerization and GitHub Actions for automated CI/CD and DevSecOps. Every code change is validated through security scanning, quality checks, and automated builds before an image is published.

---

# Docker

The application is containerized using a **multi-stage Docker build** to produce a lightweight production image while reducing attack surface and build size.

## Dockerfile

The Dockerfile consists of three stages:

### 1. Dependencies Stage

This stage installs project dependencies.

```dockerfile
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci
```

**Purpose**

- Uses the lightweight Alpine Node.js image
- Installs dependencies with `npm ci`
- Creates reproducible builds
- Caches dependencies for faster future builds

---

### 2. Build Stage

This stage compiles the Next.js application.

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build
```

**Purpose**

- Copies installed dependencies
- Injects build-time environment variables
- Compiles the production-ready Next.js application
- Generates the standalone server

---

### 3. Runtime Stage

Only the compiled application is copied into the final image.

```dockerfile
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
```

**Benefits**

- Minimal production image
- Faster deployment
- Smaller attack surface
- Faster image pulls
- Reduced storage consumption

---

# .dockerignore

The project excludes unnecessary files from the Docker build context.

```text
node_modules
.next
.git
.gitignore
Dockerfile
README.md
.env.local
.env
npm-debug.log
*.log
```

## Why exclude these files?

| File         | Reason                                        |
| ------------ | --------------------------------------------- |
| node_modules | Installed inside the container                |
| .next        | Rebuilt during Docker build                   |
| .git         | Not needed in production                      |
| README.md    | Documentation only                            |
| .env         | Prevents secrets from being baked into images |
| Logs         | Reduce image size                             |

This keeps Docker images smaller, cleaner, and more secure.

---

# Docker Compose

For local development, Docker Compose provides a simple way to build and run the application.

```yaml
version: "3.9"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}

    env_file:
      - .env

    ports:
      - "3001:3000"
```

## Features

- Builds the application automatically
- Loads environment variables from `.env`
- Maps:

```
localhost:3001 → container:3000
```

- Passes build arguments required by Next.js

---

## Running locally

Build the application

```bash
docker compose build
```

Start the application

```bash
docker compose up
```

Run in detached mode

```bash
docker compose up -d
```

Stop the containers

```bash
docker compose down
```

---

# Continuous Integration (CI)

The project uses **GitHub Actions** to implement an automated **DevSecOps pipeline**. Every push or pull request to the `develop` and `main` branches triggers a sequence of security and quality checks before a container image is built and published.

## Pipeline Trigger

```yaml
on:
  push:
    branches:
      - develop
      - main

  pull_request:
    branches:
      - develop
      - main
```

The pipeline executes automatically whenever code is pushed or a pull request targets either the `develop` or `main` branch.

---

## Pipeline Workflow

```
Developer Push
        │
        ▼
Dependency Scan
        │
        ▼
Secrets Scan
        │
        ▼
SAST (CodeQL)
        │
        ▼
Build Application
        │
        ▼
Trivy Image Scan
        │
        ▼
Push Docker Image
```

Each stage must complete successfully before the next begins, ensuring security issues are detected early in the development lifecycle.

---

## CI Pipeline Stages

### 1. Dependency Scan

```yaml
dependency-scan
```

Scans project dependencies for known vulnerabilities before the application is built.

**Purpose**

- Detect vulnerable packages
- Identify outdated dependencies
- Reduce software supply chain risks
- Encourage early remediation

---

### 2. Secrets Scan

```yaml
secrets-scan
```

Searches the repository for accidentally committed credentials or sensitive information.

Examples include:

- API keys
- Tokens
- Passwords
- Cloud credentials
- SSH keys

This helps prevent sensitive information from entering version control.

---

### 3. Static Application Security Testing (SAST)

```yaml
sast-scan
```

Uses **CodeQL** to perform static analysis of the source code.

The scan detects issues such as:

- SQL Injection
- Cross-Site Scripting (XSS)
- Command Injection
- Unsafe coding patterns
- Security vulnerabilities
- Potential bugs

Static analysis allows vulnerabilities to be identified before deployment.

---

### 4. Build Stage

```yaml
build-stage
```

Compiles the application and builds the Docker image after all security checks have passed.

The build stage validates that:

- The application compiles successfully
- Docker image creation succeeds
- Required environment variables are available
- The application is ready for deployment

---

### 5. Container Security Scan

```yaml
trivy-scan
```

Uses **Trivy** to scan the built container image.

The scan checks for:

- Operating system vulnerabilities
- Vulnerable packages
- Misconfigurations
- Embedded secrets
- High and critical CVEs

The pipeline can be configured to fail if severe vulnerabilities are detected, preventing insecure images from being published.

---

### 6. Push Stage

```yaml
push-stage
```

Publishes the validated Docker image to the configured container registry.

This stage runs only after:

- Dependency scan passes
- Secrets scan passes
- SAST passes
- Build succeeds
- Trivy scan reports no blocking vulnerabilities

Only verified images are eligible for deployment.

---

# Security-First CI/CD Approach

The pipeline follows a **shift-left security** strategy by integrating security checks into every stage of the software delivery lifecycle.

Key practices include:

- Automated dependency vulnerability scanning
- Secret detection before deployment
- Static application security testing (SAST)
- Container image vulnerability scanning
- Multi-stage Docker builds for minimal production images
- Reproducible builds using `npm ci`
- Environment variables managed outside the container image
- Sequential quality gates that prevent insecure artifacts from progressing

This approach ensures that every Docker image produced by the pipeline has undergone automated validation for code quality, dependency health, secret exposure, and container security before being released.
