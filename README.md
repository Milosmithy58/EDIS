# EDIS Monorepo

This repository contains the EDIS emergency dashboard monorepo. To run the project locally:

1. Change into the main project directory:
   ```bash
   cd edis
   ```
2. Install dependencies (Node.js 20+ recommended):
   ```bash
   npm install
   ```
3. Copy the example environment file and update any values you have keys for:
   ```bash
   cp .env.example .env
   ```
4. Start the frontend and backend together:
   ```bash
   npm run dev:all
   ```

Refer to [`edis/README.md`](edis/README.md) for full documentation, additional scripts, and architecture details.
