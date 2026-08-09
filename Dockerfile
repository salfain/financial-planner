# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# This value is intentionally non-secret. It selects the client transport at
# build time; Apps Script credentials are runtime-only variables below.
ARG NEXT_PUBLIC_FINANCE_BACKEND=apps-script
ENV NEXT_PUBLIC_FINANCE_BACKEND=$NEXT_PUBLIC_FINANCE_BACKEND
ENV VINN_BUILD_TARGET=coolify-node

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["npm", "run", "start"]
