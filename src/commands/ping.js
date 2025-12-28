import { SlashCommandBuilder } from 'discord.js';

export const command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Verify the OpenDomains bot is responsive.'),
  async execute(interaction) {
    await interaction.reply('🏓 OpenDomains is online and listening.');
  },
};
