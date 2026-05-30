# Stage 1: Build the React Application
FROM node:20-alpine AS build
WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install dependencies (use npm clean install for consistency)
RUN npm ci

# Copy all source files
COPY . .

# Build the production site
RUN npm run build

# Stage 2: Serve the application using Nginx
FROM nginx:1.25-alpine

# Copy built site from Build stage to Nginx web root
COPY --from=build /app/dist /usr/share/nginx/html

# Copy our dynamic port Nginx template file
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Default fallback port if PORT env variable is not set
ENV PORT=8080

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
