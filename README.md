# DevOps-AIOps-GitOps Playbook

A production-inspired cloud-native project demonstrating modern **DevSecOps**, **GitOps**, and **Kubernetes** practices using GitHub Actions, Docker, GitHub Container Registry (GHCR), Argo CD, and Kubernetes.

The objective of this project is to build an end-to-end automated software delivery platform that emphasizes security, automation, observability, and GitOps principles.

---

# Architecture

```text
Developer
    │
    ▼
GitHub Repository
    │
    ▼
GitHub Actions CI
    │
    ├── Dependency Scan
    ├── Secret Scan
    ├── CodeQL (SAST)
    ├── Docker Build
    ├── Trivy Image Scan
    ├── Push Image to GHCR
    └── Update GitOps Repository
                     │
                     ▼
              GitOps Repository
                     │
                     ▼
                  Argo CD
                     │
                     ▼
               Kubernetes Cluster
```

---

# Technology Stack

* Next.js
* Docker
* GitHub Actions
* GitHub Container Registry (GHCR)
* Trivy
* CodeQL
* TruffleHog
* Kubernetes (Kind)
* Argo CD
* Kustomize

---

# Features

* Multi-stage Docker builds
* DevSecOps CI pipeline
* Automated security scanning
* Static Application Security Testing (SAST)
* Container vulnerability scanning
* GitHub Container Registry integration
* GitOps deployment workflow
* Automated Kubernetes deployments with Argo CD
* Rolling updates
* Build and deployment metadata generation
* Artifact generation for every pipeline stage

---

# CI Pipeline

Every push to the **develop** or **main** branch automatically executes the following pipeline:

```text
Developer Push
        │
        ▼
Dependency Scan
        │
        ▼
Secret Scan
        │
        ▼
CodeQL (SAST)
        │
        ▼
Docker Build
        │
        ▼
Trivy Scan
        │
        ▼
Push Image to GHCR
        │
        ▼
Update GitOps Repository
```

Each stage depends on the successful completion of the previous stage, ensuring that only validated artifacts progress through the pipeline.

---

# GitOps Workflow

The deployment process follows GitOps principles:

1. Build and validate the application.
2. Publish the container image to GitHub Container Registry.
3. Update the image tag in the GitOps repository.
4. Commit and push the manifest changes.
5. Argo CD detects the change.
6. Kubernetes automatically performs a rolling deployment.

---

# Project Structure

```text
.
├── .github/
│   └── workflows/
├── docs/
│   ├── docker.md
│   ├── ci-cd.md
│   ├── gitops.md
│   ├── observability.md
│   └── security.md
├── src/
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

# Documentation

Detailed implementation guides are available in the `docs` directory:

* **Docker** – Containerization strategy and multi-stage builds
* **CI/CD** – GitHub Actions pipeline and reusable workflows
* **GitOps** – Argo CD, Kustomize, and automated deployments
* **Observability** *(coming next)* – Prometheus, Grafana, and monitoring
* **Security** *(coming soon)* – DevSecOps controls and best practices

---

# Roadmap

* ✅ Dockerized application
* ✅ GitHub Actions CI pipeline
* ✅ Dependency vulnerability scanning
* ✅ Secret scanning
* ✅ CodeQL SAST
* ✅ Trivy container scanning
* ✅ GitHub Container Registry
* ✅ GitOps deployment with Argo CD
* ✅ Kubernetes deployment
* ⏳ Prometheus monitoring
* ⏳ Grafana dashboards
* ⏳ Centralized logging
* ⏳ Alerting
* ⏳ Progressive delivery (Canary/Blue-Green)

---

# License

This project is intended for learning, experimentation, and demonstrating modern DevSecOps and GitOps practices.
