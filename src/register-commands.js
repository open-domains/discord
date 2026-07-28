import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { getCommandData } from './lib/command-loader.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  throw new Error('DISCORD_TOKEN and CLIENT_ID must be set in the environment.');
}

const rest = new REST({ version: '10' }).setToken(token);
const commandData = await getCommandData();

async function register() {
  try {
    const isGuildRegistration = Boolean(guildId);
    const target = isGuildRegistration
      ? Routes.applicationGuildCommands(clientId, guildId)
      : Routes.applicationCommands(clientId);
    const scope = isGuildRegistration ? 'guild' : 'global';
    const payload = commandData.map((command) => ({
      ...command,
      type: 1,
    }));

    console.log(`Clearing existing ${scope} commands before re-registering...`);
    await rest.put(target, { body: [] });

    console.log(`Refreshing ${payload.length} ${scope} application (/) commands...`);
    await rest.put(target, { body: payload });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error reloading application (/) commands:', error);
    process.exitCode = 1;
  }
}

register();
