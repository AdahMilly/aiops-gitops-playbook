
FROM node:22.19.0-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

FROM node:22.19.0-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runner

LABEL org.opencontainers.image.title="aiops-gitops-playbook"
LABEL org.opencontainers.image.description="Production Next.js application"
LABEL org.opencontainers.image.source="https://github.com/AdahMilly/aiops-gitops-playbook"

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/package.json ./
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

USER nonroot

CMD ["server.js"]