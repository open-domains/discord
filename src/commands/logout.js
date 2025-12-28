import { SlashCommandBuilder } from 'discord.js';
import { getCollection } from '../lib/mongo.js';

const collectionName = 'sessions';

export const command = {
  data: new SlashCommandBuilder().setName('logout').setDescription('Clear your stored OpenDomains session.'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const sessions = await getCollection(collectionName);
    const userId = interaction.user.id;
    const existing = await sessions.findOne({ userId });

    if (!existing) {
      await interaction.editReply('No OpenDomains session found to log out.');
      return;
    }

    await sessions.deleteOne({ userId });
    await interaction.editReply('You have been logged out and your stored API key was removed.');
  },
};
