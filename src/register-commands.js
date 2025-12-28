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
    const target = guildId
      ? Routes.applicationGuildCommands(clientId, guildId)
      : Routes.applicationCommands(clientId);
    const scope = guildId ? 'guild' : 'global';

    console.log(`Refreshing ${commandData.length} ${scope} application (/) commands...`);
    await rest.put(target, { body: commandData });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error reloading application (/) commands:', error);
    process.exitCode = 1;
  }
}

register();
