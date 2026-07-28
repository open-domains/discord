import { SlashCommandBuilder } from 'discord.js';
import { getCollection } from '../lib/mongo.js';
import { formatAgentResponse, getAgentName, getBase44Client } from '../lib/base44-agent.js';

export const command = {
  data: new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Send a message to the Open Domains agent.')
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('The message to send to the Open Domains agent.')
        .setRequired(true)
        .setMaxLength(2000)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const allowedRoleId = '1055639336286175274';
    const hasRole = interaction.inGuild() && interaction.member?.roles?.cache?.has(allowedRoleId);

    if (!hasRole) {
      await interaction.editReply('You do not have permission to use this command.');
      return;
    }

    const message = interaction.options.getString('message', true).trim();

    try {
      const base44 = getBase44Client();
      const conversation = await base44.agents.createConversation({
        agent_name: getAgentName(),
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

      const replyMessage = await interaction.editReply(
        agentReply ? `Message sent to the Open Domains agent. ${agentReply}`.trim() : 'Message sent to the Open Domains agent.'
      );

      const sessions = await getCollection('sessions');
      await sessions.updateOne(
        { userId: interaction.user.id },
        {
          $set: {
            userId: interaction.user.id,
            conversationId: conversation.id,
            agentName: getAgentName(),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      await sessions.updateOne(
        { messageId: replyMessage.id },
        {
          $set: {
            messageId: replyMessage.id,
            channelId: replyMessage.channelId,
            guildId: replyMessage.guildId,
            conversationId: conversation.id,
            agentName: getAgentName(),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (error) {
      const details = error.message || 'Unknown error';
      await interaction.editReply(`Unable to send the message to the Open Domains agent: ${details}`);
    }
  },
};
