# Continuous Integration & Continuous Delivery (CI/CD)

## Overview

This project implements a reusable, security-first CI/CD pipeline using **GitHub Actions**. The pipeline follows DevSecOps principles by integrating quality checks, vulnerability scanning, container security, artifact management, and GitOps automation before deploying workloads to Kubernetes.

Rather than deploying directly to a cluster, the pipeline publishes container images to GitHub Container Registry (GHCR) and updates a separate GitOps repository. Argo CD then reconciles the desired state with the Kubernetes cluster.

---

# CI/CD Architecture

```text
                 Developer
                     │
                     ▼
            Git Push / Pull Request
                     │
                     ▼
              GitHub Actions
                     │
        ┌────────────┴─────────────┐
        ▼                          ▼
 Quality & Security           Docker Build
        │                          │
        └────────────┬─────────────┘
                     ▼
              Trivy Scan
                     │
                     ▼
             Push Image to GHCR
                     │
                     ▼
          Update GitOps Repository
                     │
                     ▼
                 Argo CD
                     │
                     ▼
             Kubernetes Cluster
```

---

# Pipeline Objectives

The pipeline is designed to:

* Validate every code change
* Detect security issues early
* Produce immutable Docker images
* Generate audit artifacts
* Publish trusted container images
* Automate Kubernetes deployments through GitOps

---

# Workflow Trigger

The pipeline executes on pushes and pull requests targeting the `develop` and `main` branches.

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

---

# Reusable Workflows

Instead of placing every job in a single workflow file, the pipeline is composed of reusable workflows.

```text
.github/
└── workflows/
    ├── ci.yml
    ├── dependency-scan.yml
    ├── secrets-scan.yml
    ├── codeql.yml
    ├── build.yml
    ├── trivy.yml
    ├── push.yml
    └── gitops-update.yml
```

The `ci.yml` workflow orchestrates all stages.

---

# Pipeline Flow

```text
Dependency Scan
        │
        ▼
Secret Scan
        │
        ▼
CodeQL
        │
        ▼
Docker Build
        │
        ▼
Trivy Image Scan
        │
        ▼
Push Image to GHCR
        │
        ▼
Update GitOps Repository
```

Each stage executes only after the previous stage succeeds.

---

# Stage 1 – Dependency Scan

The pipeline begins by scanning project dependencies.

Tool:

* npm audit

Objectives:

* Detect vulnerable packages
* Identify supply chain risks
* Prevent vulnerable dependencies from progressing

The workflow generates:

```text
npm-audit-report.json
```

Only **Critical** vulnerabilities fail the pipeline.

---

# Stage 2 – Secret Scan

The repository is scanned for exposed credentials.

Tool:

* TruffleHog

Examples:

* API Keys
* Tokens
* Passwords
* SSH Keys
* Cloud Credentials

Generated artifact:

```text
trufflehog-results.json
```

---

# Stage 3 – Static Application Security Testing (SAST)

The application source code is analyzed without execution.

Tool:

* GitHub CodeQL

CodeQL identifies issues such as:

* SQL Injection
* Cross-Site Scripting
* Command Injection
* Insecure API usage
* Logic flaws
* Unsafe coding patterns

Generated artifact:

```text
codeql-results.sarif
```

The SARIF report is uploaded to GitHub Security.

---

# Stage 4 – Docker Build

After security validation, the application is containerized.

The workflow:

* Builds the Docker image
* Injects build-time environment variables
* Verifies the image
* Generates build metadata
* Exports the image as an artifact

Outputs:

```text
docker-image.tar.gz
docker-build-metadata.json
```

Exporting the image avoids rebuilding it in downstream workflows.

---

# Artifact Strategy

Instead of rebuilding images in later stages, the pipeline stores the image as a GitHub Actions artifact.

```text
Docker Build
      │
      ▼
docker-image.tar.gz
      │
      ▼
Trivy
      │
      ▼
Push
```

Benefits:

* Faster workflows
* Consistent artifacts
* Deterministic deployments

---

# Stage 5 – Container Security Scan

The exported Docker image is scanned using Trivy.

The scan evaluates:

* Operating System vulnerabilities
* Installed packages
* Known CVEs
* Misconfigurations

Reports generated:

```text
trivy-results.json
trivy-results.sarif
```

Only **Critical** vulnerabilities fail the workflow.

The SARIF report is uploaded to GitHub Code Scanning.

---

# Stage 6 – Push Image

Validated images are published to GitHub Container Registry.

Repository:

```text
ghcr.io/adahmilly/aiops-gitops-playbook
```

Images are tagged using:

* Git SHA
* develop
* latest (main only)

Example:

```text
ghcr.io/adahmilly/aiops-gitops-playbook:2754eb45716fca0a4dcc865533af720c5da9674b
```

Build metadata is also generated.

```text
push-metadata.json
```

---

# Stage 7 – GitOps Update

Instead of deploying directly to Kubernetes, the workflow updates the GitOps repository.

The process:

1. Clone GitOps repository
2. Update image tag
3. Commit changes
4. Push changes

Example commit:

```text
Deploy 2754eb45716fca0a4dcc865533af720c5da9674b
```

Argo CD automatically detects the change and deploys the new version.

---

# Artifact Generation

Every stage generates artifacts for auditing and troubleshooting.

| Stage           | Artifact                   |
| --------------- | -------------------------- |
| Dependency Scan | npm-audit-report.json      |
| Secret Scan     | trufflehog-results.json    |
| CodeQL          | codeql-results.sarif       |
| Build           | docker-image.tar.gz        |
| Build           | docker-build-metadata.json |
| Trivy           | trivy-results.json         |
| Trivy           | trivy-results.sarif        |
| Push            | push-metadata.json         |
| GitOps          | gitops-update.json         |

These artifacts provide traceability for every pipeline execution.

---

# Quality Gates

The pipeline enforces sequential quality gates.

```text
Dependency Scan
        │
        ▼
Secrets Scan
        │
        ▼
CodeQL
        │
        ▼
Docker Build
        │
        ▼
Trivy
        │
        ▼
Push Image
        │
        ▼
GitOps Update
```

A stage executes only if the previous stage succeeds.

---

# Security Strategy

The CI pipeline follows a Shift-Left security model.

Security is integrated throughout the software delivery lifecycle instead of being deferred until deployment.

Layers include:

* Dependency scanning
* Secret detection
* Static analysis
* Container scanning
* Immutable artifacts
* Registry validation

---

# Deployment Strategy

The pipeline intentionally avoids direct cluster deployments.

Instead:

```text
CI
 │
 ▼
GHCR
 │
 ▼
GitOps Repository
 │
 ▼
Argo CD
 │
 ▼
Kubernetes
```

This architecture:

* Separates CI from CD
* Uses Git as the source of truth
* Enables rollback through Git history
* Improves auditability
* Supports automated reconciliation

---

# Troubleshooting

## Docker Build Failure

Verify:

* Dockerfile
* Build arguments
* GitHub Secrets

---

## GHCR Authentication Failure

Check:

* `GITHUB_TOKEN`
* Package permissions
* Repository permissions

---

## Trivy Failure

Review:

```text
trivy-results.json
```

Address any Critical vulnerabilities before retrying.

---

## GitOps Update Failure

Verify:

* GitOps Personal Access Token
* Repository permissions
* Branch protection rules

---

# Best Practices

* Use reusable workflows
* Fail early on security issues
* Generate artifacts for every stage
* Use immutable image tags
* Avoid rebuilding Docker images
* Publish only validated images
* Separate CI from CD
* Automate GitOps updates
* Store deployment history in Git

---

# Summary

The CI/CD implementation provides a secure, automated, and reproducible software delivery process. By combining reusable GitHub Actions workflows, sequential quality gates, artifact generation, container security scanning, and GitOps automation, every deployment is validated, traceable, and fully auditable before reaching the Kubernetes cluster.

This pipeline serves as the foundation for the project's GitOps workflow and prepares the platform for future enhancements such as observability, progressive delivery, and policy enforcement.
