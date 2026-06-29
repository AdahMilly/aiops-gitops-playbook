# Security

Security is integrated into every stage of the software delivery lifecycle using a **shift-left DevSecOps** approach. Instead of treating security as a final deployment step, every commit is automatically validated before it can become a deployable artifact.

---

# Security Pipeline

Every push to the repository passes through multiple security gates.

```
Developer Push
       │
       ▼
Dependency Scan
       │
       ▼
Secret Scan
       │
       ▼
Static Code Analysis
       │
       ▼
Docker Build
       │
       ▼
Container Vulnerability Scan
       │
       ▼
Publish Image
```

If any mandatory security stage fails, the pipeline stops immediately.

---

# Security Layers

The project uses multiple security controls covering the application, dependencies, source code, and container image.

| Layer | Tool |
|---------|------|
| Dependency Security | npm audit |
| Secret Detection | TruffleHog |
| Static Application Security Testing | CodeQL |
| Container Security | Trivy |
| Image Registry | GitHub Container Registry |

---

# 1. Dependency Scanning

Dependencies are scanned before the application is built.

Tool:

- npm audit

The scan checks for known vulnerabilities in third-party packages pulled from npm.

Examples include:

- Remote Code Execution
- Prototype Pollution
- Arbitrary Command Execution
- Denial of Service
- Privilege Escalation

The pipeline is configured to fail only when **Critical** vulnerabilities are detected.

Example:

```bash
npm audit --audit-level=critical
```

A complete JSON report is generated and stored as a GitHub Actions artifact.

Artifact:

```
dependency-report.json
```

---

# 2. Secret Scanning

Repositories are scanned using **TruffleHog** to detect accidentally committed secrets.

Examples include:

- GitHub Tokens
- AWS Keys
- Azure Credentials
- GCP Credentials
- SSH Keys
- Private Keys
- Database Passwords
- API Keys

Example workflow:

```
Repository
      │
      ▼
TruffleHog
      │
      ▼
Secret Report
```

Generated report:

```
trufflehog-results.json
```

---

# 3. Static Application Security Testing (SAST)

The pipeline uses **GitHub CodeQL** to perform static code analysis.

Unlike dependency scanning, CodeQL analyzes the application's source code for insecure coding patterns.

Examples include:

- SQL Injection
- Cross-Site Scripting (XSS)
- Command Injection
- Path Traversal
- Unsafe Deserialization
- Hardcoded Credentials
- Authentication Bypass
- Logic Errors

The results are uploaded to GitHub Security.

Generated report:

```
codeql-results.sarif
```

---

# 4. Container Image Scanning

After the Docker image is built, Trivy scans the image before it is published.

Checks include:

- Operating System CVEs
- Package Vulnerabilities
- Embedded Secrets
- Configuration Issues
- License Information

The scan is configured to fail only when **Critical** vulnerabilities are detected.

Example configuration:

```yaml
severity: CRITICAL
exit-code: 1
```

Artifacts generated:

```
trivy-results.json
trivy-results.sarif
```

The SARIF report is uploaded to GitHub Code Scanning.

---

# Artifact Generation

Every security stage produces machine-readable reports that can be downloaded after a workflow run.

| Stage | Artifact |
|---------|----------|
| Dependency Scan | dependency-report.json |
| Secret Scan | trufflehog-results.json |
| CodeQL | codeql-results.sarif |
| Trivy | trivy-results.json |
| Trivy | trivy-results.sarif |

These reports provide evidence of the security posture of each build and can be retained for auditing or troubleshooting.

---

# GitHub Security Dashboard

CodeQL and Trivy upload SARIF reports directly to GitHub.

Security findings can be viewed under:

```
Repository

→ Security

    → Code scanning alerts
```

This provides a centralized dashboard for tracking vulnerabilities over time.

---

# Security Gates

The CI pipeline enforces mandatory quality gates.

| Stage | Blocks Pipeline |
|---------|----------------|
| Dependency Scan | Critical vulnerabilities |
| Secret Scan | Yes |
| CodeQL | Analysis failure |
| Docker Build | Build failure |
| Trivy | Critical vulnerabilities |

Only images that pass every gate are published to the container registry.

---

# Security Best Practices

The project follows several cloud-native security principles.

## Multi-stage Docker Builds

Only production artifacts are included in the runtime image, reducing attack surface.

---

## Minimal Runtime Image

The final container excludes:

- Source code
- Development dependencies
- Build tools
- Package managers

This produces a smaller and more secure image.

---

## Secrets Management

Sensitive values are never committed to source control.

Runtime configuration is supplied through:

- GitHub Secrets
- Build arguments
- Kubernetes ConfigMaps
- Kubernetes Secrets (recommended for production)

---

## Immutable Container Images

Each Docker image is tagged using the Git commit SHA.

Example:

```
ghcr.io/adahmilly/aiops-gitops-playbook:2754eb45716fca0a4dcc865533af720c5da9674b
```

Immutable images improve traceability and simplify rollbacks.

---

## Shift-Left Security

Security checks are executed before deployment rather than after release.

Benefits include:

- Earlier vulnerability detection
- Lower remediation costs
- Faster developer feedback
- Reduced production risk

---

# Security Workflow Summary

```
Developer Push
        │
        ▼
Dependency Scan
        │
        ▼
Secret Scan
        │
        ▼
CodeQL Analysis
        │
        ▼
Docker Build
        │
        ▼
Trivy Image Scan
        │
        ▼
GitHub Container Registry
        │
        ▼
GitOps Deployment
```

Every container image deployed to Kubernetes has successfully passed all configured security gates, ensuring that only validated and trusted artifacts are promoted through the delivery pipeline.