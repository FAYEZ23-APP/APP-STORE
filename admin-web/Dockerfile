# ─── Stage 1: Build Frontend Assets ───────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Accept API URL build argument from Railway
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Install dependencies deterministically
COPY package*.json ./
RUN npm ci

# Copy source and compile production bundle
COPY . .
RUN npm run build

# ─── Stage 2: Production Nginx Server ─────────────────────────
FROM nginx:alpine AS runtime

# Default port (Railway injects PORT dynamically at runtime)
ENV PORT=80

# Copy compiled SPA static assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy Nginx template configuration
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

# Dynamically substitute $PORT and run Nginx with SPA fallback
CMD ["/bin/sh", "-c", "envsubst '$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
