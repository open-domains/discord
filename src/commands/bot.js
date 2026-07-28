import { createClient } from '@base44/sdk';
import { SlashCommandBuilder } from 'discord.js';

const appId = process.env.BASE44_APP_ID || '69b6e91dbe1cdaa155ba939d';
const agentName = process.env.BASE44_AGENT_NAME;
const serverUrl = process.env.BASE44_SERVER_URL || 'https://base44.app';
const apiKey = process.env.BASE44_API_KEY || process.env.BASE44_AGENT_API_KEY || '0c695cc91dea47bc9cfeaaca3830f3cc';

function formatAgentResponse(payload) {
  if (typeof payload === 'string') return payload;

  if (payload && typeof payload === 'object') {
    return payload.message || payload.result || payload.output || payload.reply || JSON.stringify(payload);
  }

  return '';
}

function getBase44Client() {
  if (!appId) {
    throw new Error('Base44 app integration is not configured. Set BASE44_APP_ID first.');
  }

  if (!agentName) {
    throw new Error('Base44 agent integration is not configured. Set BASE44_AGENT_NAME first.');
  }

  return createClient({
    appId,
    headers: {
      api_key: apiKey,
    },
  });
}

export const command = {
  data: new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Send a message to your configured Base44 agent.')
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('The message to send to the Base44 agent.')
        .setRequired(true)
        .setMaxLength(2000)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const message = interaction.options.getString('message', true).trim();

    try {
      const base44 = getBase44Client();
      const conversation = await base44.agents.createConversation({
        agent_name: agentName,
        metadata: {
          source: 'discord',
          user: interaction.user.username,
          user_id: interaction.user.id,
          channel_id: interaction.channelId ?? null,
        },
      });

      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: message,
      });

      const refreshedConversation = await base44.agents.getConversation(conversation.id);
      const latestAssistantMessage = [...(refreshedConversation?.messages ?? [])]
        .reverse()
        .find((entry) => entry.role === 'assistant' && entry.content);
      const agentReply = formatAgentResponse(latestAssistantMessage?.content);

      await interaction.editReply(
        agentReply ? `Message sent to the Base44 agent. ${agentReply}`.trim() : 'Message sent to the Base44 agent.'
      );
    } catch (error) {
      const details = error.message || 'Unknown error';
      await interaction.editReply(`Unable to send the message to the Base44 agent: ${details}`);
    }
  },
};
