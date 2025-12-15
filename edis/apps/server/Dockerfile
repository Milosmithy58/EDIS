# --- Build Stage ---
FROM node:20-slim AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy monorepo root package.json and lock files
# These paths are now relative to the build context (EDIS/edis)
COPY package.json package-lock.json ./

# Copy server's package.json and lock files
COPY apps/server/package.json ./apps/server/

# Copy monorepo root tsconfig and server's tsconfig
COPY tsconfig.base.json ./
COPY apps/server/tsconfig.json ./apps/server/
COPY apps/server/tsconfig.build.json ./apps/server/

# Copy the entire server application source code
COPY apps/server/src ./apps/server/src

# Install dependencies for the entire monorepo
RUN npm install

# Build the TypeScript code for the server
# This will create the 'dist' directory inside apps/server
RUN npm run build --workspace @edis/server

# --- Production Stage ---
FROM node:20-slim

# Set the working directory
WORKDIR /app

# Copy the root 'node_modules' from the builder stage (hoisted dependencies)
COPY --from=builder /app/node_modules ./node_modules

# Copy the built server application (dist folder) and its package.json
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json

# If there are any server-specific node_modules that are not hoisted, copy them
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules

# Set the entry point to be within the server app
WORKDIR /app/apps/server

# Set environment variable for production
ENV NODE_ENV production

# Expose the port the Express app listens on
EXPOSE 4000

# Command to run the application
CMD ["npm", "start"]