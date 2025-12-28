import { SlashCommandBuilder } from 'discord.js';

export const command = {
  data: new SlashCommandBuilder()
    .setName('about')
    .setDescription('Learn what the OpenDomains Discord bot is for.'),
  async execute(interaction) {
    await interaction.reply(
      [
        'OpenDomains connects community-owned domains with the projects that need them.',
        'Use this bot to check status, request domains, and get contributor updates as features come online.',
      ].join(' ')
    );
  },
};
