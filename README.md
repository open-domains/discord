# OpenDomains Discord Bot

OpenDomains Discord interface built with discord.js.

## Prerequisites
- Node.js 18.17+ and npm.
- A Discord application with a bot token.

## Setup
1. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN`, `CLIENT_ID`, and optionally `GUILD_ID` for guild-scoped development commands.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Register slash commands (guild registration is faster for iteration):
   ```bash
   npm run register
   ```
4. Run the bot:
   ```bash
   npm start
   ```

## Available commands
- `/ping` – health check for the bot.
- `/about` – quick context on the OpenDomains bot.

Add new commands by creating files in `src/commands/` that export `command = { data, execute }`. Commands are auto-loaded by both the runtime and the registration script.
