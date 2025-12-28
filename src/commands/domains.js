import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getCollection } from '../lib/mongo.js';
import { listDomains } from '../lib/open-domains.js';

const collectionName = 'sessions';

function formatDomain(domain) {
  const records = Array.isArray(domain.records) ? domain.records.join(', ') : '—';
  const created = domain.createdAt ? new Date(domain.createdAt).toLocaleString() : 'unknown';

  return [
    `**Status:** ${domain.status ?? 'unknown'}`,
    `**Type:** ${domain.type ?? '—'}`,
    `**Records:** ${records}`,
    `**Source:** ${domain.source ?? '—'}`,
    `**Created:** ${created}`,
  ].join('\n');
}

export const command = {
  data: new SlashCommandBuilder()
    .setName('domains')
    .setDescription('List your OpenDomains domains and their status.'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const sessions = await getCollection(collectionName);
    const userId = interaction.user.id;
    const session = await sessions.findOne({ userId });

    if (!session?.apiKey) {
      await interaction.editReply('You need to /login first to link your OpenDomains account.');
      return;
    }

    try {
      const domains = await listDomains(session.apiKey);

      if (!domains.length) {
        await interaction.editReply('No domains found for your account.');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('Your OpenDomains domains')
        .setColor(0x5865f2)
        .setDescription('Domains linked to your account.');

      domains.slice(0, 25).forEach((domain) => {
        embed.addFields({
          name: domain.id ?? 'Unknown domain',
          value: formatDomain(domain),
          inline: false,
        });
      });

      if (domains.length > 25) {
        embed.addFields({
          name: 'More domains not shown',
          value: `Showing 25 of ${domains.length}.`,
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply(`Unable to fetch domains: ${error.message}`);
    }
  },
};
