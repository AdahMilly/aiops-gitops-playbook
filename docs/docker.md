# Docker Guide

## Overview

This project uses Docker to package the application into a portable, reproducible, and production-ready container image. By containerizing the application, we ensure that it behaves consistently across development, testing, and production environments.

The application is built using a **multi-stage Docker build**, allowing dependencies, compilation, and runtime execution to be isolated into separate stages. This significantly reduces the final image size while minimizing the attack surface.

---

# Objectives

The Docker implementation aims to:

* Produce reproducible builds
* Minimize image size
* Improve security
* Separate build-time and runtime dependencies
* Support local development using Docker Compose
* Generate production-ready standalone Next.js images

---

# Architecture

```text
                Source Code
                     │
                     ▼
            Docker Multi-stage Build
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
 Dependencies      Build         Runtime Image
 (npm ci)       (next build)     (Production)
                     │
                     ▼
             Standalone Server
```

---

# Multi-Stage Docker Build

The application uses three build stages:

```text
deps
   │
   ▼
builder
   │
   ▼
runner
```

Each stage has a distinct responsibility.

---

# Stage 1 – Dependencies

The first stage installs project dependencies.

```dockerfile
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci
```

### Why `npm ci`?

Unlike `npm install`, `npm ci`:

* Installs dependencies exactly as specified in `package-lock.json`
* Produces deterministic builds
* Executes faster
* Removes existing `node_modules`
* Is recommended for CI/CD pipelines

---

### Why Alpine Linux?

The project uses:

```dockerfile
node:20-alpine
```

Benefits include:

* Small image size
* Reduced attack surface
* Faster image downloads
* Lower storage consumption

---

# Stage 2 – Build

The builder stage compiles the Next.js application.

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

---

## Build Arguments

Some Next.js applications require environment variables during compilation.

The Docker build injects them as build arguments:

```dockerfile
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
```

These values are supplied by the CI pipeline during image creation.

Example:

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=xxxxx \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
```

---

## Why Build Inside Docker?

Building inside the container guarantees:

* Consistent Node.js version
* Consistent operating system
* Identical dependencies
* No host machine differences
* Reproducible production builds

---

# Stage 3 – Runtime

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

---

## Why Copy Only the Standalone Output?

The runtime image excludes:

* Source code
* Development dependencies
* TypeScript
* Test files
* Build tools

Only the compiled server is included.

Benefits:

* Smaller images
* Faster deployments
* Lower attack surface
* Reduced storage costs

---

# Docker Ignore

The project excludes unnecessary files during the build.

```text
node_modules
.next
.git
.gitignore
README.md
.env
.env.local
Dockerfile
*.log
```

---

## Why Use `.dockerignore`?

Without it:

* Build context becomes larger
* Images build more slowly
* Secrets may accidentally be copied
* Cache invalidation occurs more frequently

Using `.dockerignore` keeps builds efficient and secure.

---

# Docker Compose

Docker Compose simplifies local development.

```yaml
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

---

## Local Development

### Build the image

```bash
docker compose build
```

---

### Start the application

```bash
docker compose up
```

---

### Run in detached mode

```bash
docker compose up -d
```

---

### Stop containers

```bash
docker compose down
```

---

### View logs

```bash
docker compose logs -f
```

---

### Rebuild after changes

```bash
docker compose up --build
```

---

# Environment Variables

The project distinguishes between build-time and runtime variables.

### Build-time

These are required when compiling the Next.js application.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

These are passed using Docker build arguments.

---

### Runtime

Runtime configuration is provided by Kubernetes using ConfigMaps and Secrets.

This keeps sensitive information outside the container image.

---

# Image Optimization

The project incorporates several optimization techniques:

| Technique                 | Benefit               |
| ------------------------- | --------------------- |
| Multi-stage builds        | Smaller images        |
| Alpine base image         | Lightweight runtime   |
| npm ci                    | Reproducible builds   |
| Standalone Next.js output | Minimal runtime       |
| .dockerignore             | Reduced build context |
| Cached dependency layer   | Faster rebuilds       |

---

# Security Considerations

The Docker implementation follows container security best practices.

## Multi-stage builds

Development tools are excluded from the runtime image.

---

## Minimal base image

Using Alpine reduces unnecessary packages and potential vulnerabilities.

---

## No Secrets in the Image

Secrets are never committed to the repository or baked into the image.

Instead, they are injected at:

* Build time (GitHub Actions secrets)
* Runtime (Kubernetes ConfigMaps and Secrets)

---

## Immutable Images

Each Docker image is tagged using the Git commit SHA.

Example:

```text
ghcr.io/adahmilly/aiops-gitops-playbook:2754eb45716fca0a4dcc865533af720c5da9674b
```

This ensures every deployment references an immutable artifact.

---

# Integration with CI/CD

Docker is fully integrated into the GitHub Actions pipeline.

```text
Source Code
      │
      ▼
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
Export Image Artifact
      │
      ▼
Trivy Scan
      │
      ▼
Push to GHCR
```

The built image is exported as a compressed artifact, allowing downstream workflow stages to reuse it without rebuilding.

---

# Troubleshooting

## Missing Supabase Environment Variables

Error:

```text
Missing NEXT_PUBLIC_SUPABASE_URL
```

Solution:

Ensure the variables are passed as Docker build arguments.

---

## Build Fails During `next build`

Verify:

* Environment variables
* Dockerfile build arguments
* GitHub Actions secrets

---

## Port Already in Use

If port `3001` is occupied:

```yaml
ports:
  - "3002:3000"
```

---

## Docker Cache Issues

Force a clean build:

```bash
docker compose build --no-cache
```

---

# Best Practices

* Use multi-stage Docker builds
* Prefer `npm ci` over `npm install`
* Keep runtime images minimal
* Never embed secrets in images
* Use immutable image tags
* Exclude unnecessary files with `.dockerignore`
* Separate build-time and runtime configuration
* Scan images before publishing
* Publish only validated images

---

# Summary

The Docker implementation provides a lightweight, secure, and production-ready containerization strategy. By combining multi-stage builds, immutable image tagging, optimized runtime images, and CI/CD integration, the project delivers a consistent deployment artifact that forms the foundation of the GitOps workflow implemented throughout the rest of the platform.
