import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { getCollection } from './lib/mongo.js';
import { loadCommands } from './lib/command-loader.js';
import { formatAgentResponse, getAgentName, getBase44Client } from './lib/base44-agent.js';

const token = process.env.DISCORD_TOKEN;

if (!token) {
  throw new Error('Missing DISCORD_TOKEN in environment.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const commands = await loadCommands();

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);

  readyClient.user.setPresence({
    activities: [{ name: 'OpenDomains Management system' }],
    status: 'online',
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) {
    console.warn(`No handler registered for /${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);

    const reply = {
      content: 'There was an error while executing this command.',
      ephemeral: true,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.inGuild()) return;
  if (!message.reference?.messageId) return;
  if (!message.member?.roles?.cache?.has('1055639336286175274')) return;
  
  const content = message.content?.trim();
  if (!content) return;

  const sessions = await getCollection('sessions');
  const existing = await sessions.findOne({ messageId: message.reference.messageId });

  if (!existing?.conversationId) {
    return;
  }

  try {
    const base44 = getBase44Client();
    await base44.agents.addMessage(
      { id: existing.conversationId },
      {
        role: 'user',
        content,
      }
    );

    const refreshedConversation = await base44.agents.getConversation(existing.conversationId);
    const latestAssistantMessage = [...(refreshedConversation?.messages ?? [])]
      .reverse()
      .find((entry) => entry.role === 'assistant' && entry.content);
    const agentReply = formatAgentResponse(latestAssistantMessage?.content);

    await message.reply(agentReply ? `Forwarded to the agent. ${agentReply}`.trim() : 'Forwarded to the agent.');
  } catch (error) {
    console.error(error);
    await message.reply(`Unable to forward your message to the agent: ${error.message}`);
  }
});

client.login(token);
