# EDIS Monorepo

This repository contains the EDIS emergency dashboard monorepo. To run the project locally:

## Install Node.js, npm, and Homebrew (if needed)

Node.js bundles the `npm` CLI. If your device does not already have them, follow the platform-specific steps below before running the project commands.

### macOS

1. Download and run the latest **LTS** installer from [nodejs.org](https://nodejs.org/en/download) (includes npm).
2. Alternatively, install [Homebrew](https://brew.sh/) if it is not present:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
3. After Homebrew is installed, you can install Node.js (with npm) via:
   ```bash
   brew install node@20
   ```
4. Verify the installation:
   ```bash
   node -v
   npm -v
   ```

### Windows

1. Download the **LTS** Windows installer from [nodejs.org](https://nodejs.org/en/download) and complete the setup wizard (npm is included).
2. Optional: install via [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/) if you prefer command line management:
   ```powershell
   winget install --id OpenJS.NodeJS.LTS -e
   ```
3. Confirm installation in a new PowerShell window:
   ```powershell
   node -v
   npm -v
   ```

### Linux (Debian/Ubuntu)

1. Install curl if missing and add the NodeSource repository for Node 20:
   ```bash
   sudo apt-get update && sudo apt-get install -y curl
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   ```
2. Install Node.js (with npm):
   ```bash
   sudo apt-get install -y nodejs
   ```
3. Verify:
   ```bash
   node -v
   npm -v
   ```
4. Optional: install Homebrew on Linux if you prefer that workflow:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> ~/.profile
   eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
   ```

## Project setup

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
