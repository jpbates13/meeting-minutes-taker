# Frontend: static Vite build served by nginx.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Where the browser reaches the API, without scheme, e.g. "minutes.example.com/api".
# Empty → <page host>:8443, as in development.
ARG VITE_BACKEND_HOST=""
ENV VITE_BACKEND_HOST=$VITE_BACKEND_HOST
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
