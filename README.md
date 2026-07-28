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

## Docker
1. Copy `.env.example` to `.env` and fill in the Discord values. For the bundled MongoDB service, use:
   ```bash
   MONGO_URI=mongodb://mongo:27017/open_domains_bot
   ```
2. Build the image:
   ```bash
   docker compose build
   ```
3. Register slash commands:
   ```bash
   docker compose run --rm bot npm run register
   ```
4. Start the bot and MongoDB:
   ```bash
   docker compose up -d
   ```
5. View logs:
   ```bash
   docker compose logs -f bot
   ```

## Available commands
- `/ping` – health check for the bot.
- `/about` – quick context on the OpenDomains bot.
- `/bot <message>` – send a message to your configured Base44 agent.
- `/login` – start device-based authentication with OpenDomains and store the session in MongoDB.
- `/logout` – clear your stored OpenDomains session/API key.
- `/domains` – show your Open Domains account stats, or pass `domain` to list DNS records.
- `/check` – check whether a subdomain label is available.
- `/request-subdomain` – submit a new subdomain request for review.

## Login prerequisites
- MongoDB connection string in `MONGO_URI` (and optional `MONGO_DB_NAME` override).
- The API defaults to `https://api.open-domains.net`, with device auth at `/deviceAuth` and the public API at `/`.
- Device auth uses `POST /deviceAuth` with `action=request_code` and `action=poll`. Authenticated API calls use `Authorization: Bearer <api_key>`.
- Override with `OPEN_DOMAINS_API_BASE`, `OPEN_DOMAINS_DEVICE_AUTH_PATH`, or `OPEN_DOMAINS_PUBLIC_API_PATH` if the service uses different paths.
- For offline testing, set `OPEN_DOMAINS_MOCK_DEVICE_AUTH=true` to return dummy device codes and a mock API key without calling the real service.

## Base44 agent integration
- Set `BASE44_APP_ID` to the Base44 app that owns the agent you want to reach.
- Set `BASE44_AGENT_NAME` to the agent name configured in that app.
- Optionally set `BASE44_API_TOKEN` or `BASE44_AGENT_API_KEY` if your Base44 app requires an authenticated client.
- Optionally set `BASE44_SERVER_URL` if you are not using the default Base44 Cloud endpoint.

Add new commands by creating files in `src/commands/` that export `command = { data, execute }`. Commands are auto-loaded by both the runtime and the registration script.
