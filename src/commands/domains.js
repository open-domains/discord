import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getCollection } from '../lib/mongo.js';
import { UnauthorizedError, getMe, listRecords } from '../lib/open-domains.js';

const collectionName = 'sessions';

function formatRecord(record) {
  const ttl = record.ttl ? `${record.ttl}s` : 'auto';

  return [
    `**Type:** ${record.type ?? 'unknown'}`,
    `**Content:** ${record.content ?? '—'}`,
    `**TTL:** ${ttl}`,
    `**Proxied:** ${record.proxied ? 'yes' : 'no'}`,
  ].join('\n');
}

function formatStats(stats = {}) {
  return [
    `**Active records:** ${stats.active_records ?? 0}`,
    `**Total records:** ${stats.total_records ?? 0}`,
    `**Total requests:** ${stats.total_requests ?? 0}`,
    `**Pending requests:** ${stats.pending_requests ?? 0}`,
    `**Active API tokens:** ${stats.active_api_tokens ?? 0}`,
  ].join('\n');
}

export const command = {
  data: new SlashCommandBuilder()
    .setName('domains')
    .setDescription('Show your Open Domains account stats or DNS records for a domain.')
    .addStringOption((option) =>
      option
        .setName('domain')
        .setDescription('Domain or subdomain to list DNS records for.')
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const sessions = await getCollection(collectionName);
    const userId = interaction.user.id;
    const session = await sessions.findOne({ userId });

    if (!session?.apiKey) {
      await interaction.editReply('You need to /login first to link your OpenDomains account.');
      return;
    }

    try {
      const domain = interaction.options.getString('domain');

      if (!domain) {
        const me = await getMe(session.apiKey);
        const embed = new EmbedBuilder()
          .setTitle('Your Open Domains account')
          .setColor(0x5865f2)
          .setDescription(me.email ?? me.display_name ?? 'Authenticated Open Domains account.')
          .addFields({
            name: 'Stats',
            value: formatStats(me.stats),
            inline: false,
          });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const records = await listRecords(domain);

      if (!records.length) {
        await interaction.editReply(`No DNS records found for ${domain}.`);
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`DNS records for ${domain}`)
        .setColor(0x5865f2)
        .setDescription('Records returned by the Open Domains public API.');

      records.slice(0, 25).forEach((record) => {
        embed.addFields({
          name: record.name ?? domain,
          value: formatRecord(record),
          inline: false,
        });
      });

      if (records.length > 25) {
        embed.addFields({
          name: 'More records not shown',
          value: `Showing 25 of ${records.length}.`,
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        await sessions.deleteOne({ userId });
        await interaction.editReply(
          'Your stored OpenDomains API key is no longer valid. Please /login again.'
        );
        return;
      }

      await interaction.editReply(`Unable to fetch domains: ${error.message}`);
    }
  },
};
