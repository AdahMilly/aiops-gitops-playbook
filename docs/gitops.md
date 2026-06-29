# GitOps

The deployment process follows a **GitOps** model where Git serves as the single source of truth for the Kubernetes cluster.

Rather than deploying applications directly from the CI pipeline, every deployment is performed by updating Kubernetes manifests stored in a dedicated GitOps repository. Argo CD continuously monitors this repository and reconciles the cluster state whenever changes are detected.

---

# GitOps Architecture

```
                Application Repository
                        │
                        ▼
                 GitHub Actions CI
                        │
                        ▼
              Build & Security Validation
                        │
                        ▼
              Publish Image to GHCR
                        │
                        ▼
         Update GitOps Repository Manifest
                        │
                        ▼
                 Git Commit & Push
                        │
                        ▼
                 GitOps Repository
                        │
                        ▼
                     Argo CD
                        │
                        ▼
             Kubernetes Cluster (Kind)
```

The CI pipeline never communicates directly with Kubernetes.

Instead, Kubernetes pulls its desired state from Git through Argo CD.

---

# Why GitOps?

Traditional CI/CD pipelines typically deploy directly into a cluster.

```
Developer
      │
      ▼
CI Pipeline
      │
      ▼
kubectl apply
      │
      ▼
Kubernetes
```

With GitOps:

```
Developer
      │
      ▼
CI Pipeline
      │
      ▼
Update Git Repository
      │
      ▼
Argo CD
      │
      ▼
Kubernetes
```

This approach provides:

- Declarative deployments
- Version-controlled infrastructure
- Automatic drift correction
- Easy rollbacks
- Complete audit history

---

# Repository Structure

The project is split into two repositories.

## Application Repository

Contains the application source code.

```
aiops-gitops-playbook/

├── app/
├── Dockerfile
├── .github/
├── package.json
└── README.md
```

---

## GitOps Repository

Contains Kubernetes manifests.

```
aiops-gitops/

├── apps/
│
│   └── aiops-playbook/
│
│       ├── base/
│       │
│       └── overlays/
│            ├── dev/
│            └── prod/
│
├── clusters/
│
│   ├── dev/
│   └── prod/
│
└── argocd/
```

The GitOps repository contains no application source code.

It only stores deployment manifests.

---

# Kustomize

Kustomize is used to manage environment-specific configuration.

Directory structure:

```
apps/

└── aiops-playbook

    ├── base

    │     deployment.yaml
    │     service.yaml
    │     ingress.yaml
    │     configmap.yaml
    │     namespace.yaml

    └── overlays

          ├── dev
          │     kustomization.yaml
          │     patch.yaml
          │
          └── prod
```

The base manifests define the common application configuration.

Overlays customize environment-specific settings such as:

- Replica count
- Image tag
- Resource limits
- Environment variables

---

# Base Deployment

The base deployment defines the application's default Kubernetes configuration.

Example:

```yaml
containers:
- name: aiops-playbook
  image: ghcr.io/adahmilly/aiops-gitops-playbook:develop
```

Environment-specific overlays replace the image tag during deployment.

---

# Image Updates

After a successful CI run, GitHub Actions updates the image tag inside the GitOps repository.

Example:

Before:

```yaml
image: ghcr.io/adahmilly/aiops-gitops-playbook:develop
```

After:

```yaml
image: ghcr.io/adahmilly/aiops-gitops-playbook:2754eb45716fca0a4dcc865533af720c5da9674b
```

Each deployment references an immutable image built from a specific Git commit.

---

# GitHub Actions Deployment Workflow

Once the image has been published to GitHub Container Registry, a dedicated workflow updates the GitOps repository.

Workflow:

```
Publish Image
      │
      ▼
Checkout GitOps Repository
      │
      ▼
Update Image Tag
      │
      ▼
Commit Changes
      │
      ▼
Push to GitOps Repository
```

No direct Kubernetes access is required.

---

# Argo CD

Argo CD continuously watches the GitOps repository.

Whenever a commit changes the desired state:

```
Git Commit
      │
      ▼
Argo CD Detects Change
      │
      ▼
Synchronize Cluster
      │
      ▼
Rolling Deployment
```

No manual deployment commands are necessary.

---

# Argo CD Application

The application is registered with Argo CD using an Application manifest.

Example:

```yaml
spec:
  source:
    repoURL: https://github.com/AdahMilly/aiops-gitops.git
    path: clusters/dev
    targetRevision: main

  destination:
    server: https://kubernetes.default.svc
    namespace: aiops

  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

This instructs Argo CD to:

- Watch the GitOps repository
- Deploy manifests from `clusters/dev`
- Automatically synchronize changes
- Remove deleted resources
- Correct configuration drift

---

# Automatic Synchronization

Argo CD continuously compares:

Desired State

```
Git Repository
```

with

Actual State

```
Kubernetes Cluster
```

Whenever differences are detected:

```
Git
 │
 ▼
Desired State

≠

Cluster
 │
 ▼
Actual State
```

Argo CD automatically reconciles the cluster.

---

# Self-Healing

If someone manually changes a Kubernetes resource:

```
kubectl edit deployment
```

The cluster temporarily differs from Git.

Argo CD detects this drift and restores the configuration stored in Git.

This guarantees that Git remains the single source of truth.

---

# Automatic Pruning

Suppose a deployment is removed from Git.

Argo CD automatically removes the corresponding Kubernetes resources.

```
Git Delete
      │
      ▼
Argo CD
      │
      ▼
Delete Kubernetes Resource
```

No manual cleanup is required.

---

# Deployment Flow

A complete deployment follows these steps.

```
Developer Push
        │
        ▼
GitHub Actions

Dependency Scan
        │
Secret Scan
        │
CodeQL
        │
Docker Build
        │
Trivy
        │
Push Image
        │
GitOps Update
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

---

# Rollback Strategy

Rolling back is straightforward because deployments are version-controlled.

Example:

```
git revert
```

or

```
git checkout previous commit
```

After pushing the change:

```
Git
 │
 ▼
Argo CD
 │
 ▼
Cluster Rollback
```

No Kubernetes commands are required.

---

# Deployment Verification

Deployment status can be verified using Kubernetes.

View Deployments:

```bash
kubectl get deployments -n aiops
```

View Pods:

```bash
kubectl get pods -n aiops
```

View Services:

```bash
kubectl get svc -n aiops
```

Monitor rollout:

```bash
kubectl rollout status deployment/aiops-playbook -n aiops
```

View application:

```bash
kubectl get ingress -n aiops
```

---

# Benefits

This GitOps implementation provides several advantages:

- Declarative deployments
- Immutable image versions
- Automated synchronization
- Automatic rollback through Git history
- Continuous reconciliation
- Drift detection
- Self-healing infrastructure
- Full deployment audit trail
- Separation of application and infrastructure repositories
- Environment-specific configuration using Kustomize

---

# GitOps Workflow Summary

```
Developer Push
        │
        ▼
GitHub Actions
        │
        ▼
Security Validation
        │
        ▼
Docker Build
        │
        ▼
Publish Image (GHCR)
        │
        ▼
Update GitOps Repository
        │
        ▼
Git Commit
        │
        ▼
Argo CD Detects Change
        │
        ▼
Sync Kubernetes
        │
        ▼
Rolling Deployment
        │
        ▼
Application Updated
```

This architecture ensures that every deployment is reproducible, auditable, automated, and driven entirely from version-controlled infrastructure.