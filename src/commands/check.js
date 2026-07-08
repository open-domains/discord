import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { checkSubdomain } from '../lib/open-domains.js';

export const command = {
  data: new SlashCommandBuilder()
    .setName('check')
    .setDescription('Check whether an Open Domains subdomain is available.')
    .addStringOption((option) =>
      option
        .setName('subdomain')
        .setDescription('Subdomain label to check, without the root domain.')
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const subdomain = interaction.options.getString('subdomain', true).trim().toLowerCase();

    try {
      const result = await checkSubdomain(subdomain);
      const embed = new EmbedBuilder()
        .setTitle(`Availability: ${subdomain}`)
        .setColor(result.status === 'available' ? 0x2ecc71 : 0xf1c40f)
        .addFields(
          { name: 'Status', value: result.status ?? 'unknown', inline: true },
          { name: 'Message', value: result.message ?? 'No message returned.', inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply(`Unable to check availability: ${error.message}`);
    }
  },
};
