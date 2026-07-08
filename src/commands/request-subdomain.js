import { SlashCommandBuilder } from 'discord.js';
import { getCollection } from '../lib/mongo.js';
import { UnauthorizedError, submitSubdomainRequest } from '../lib/open-domains.js';

const collectionName = 'sessions';
const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'];

export const command = {
  data: new SlashCommandBuilder()
    .setName('request-subdomain')
    .setDescription('Submit a new Open Domains subdomain request.')
    .addStringOption((option) =>
      option
        .setName('subdomain')
        .setDescription('Subdomain label only, without the root domain.')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('root-domain').setDescription('Root domain, such as is-a.dev.').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('record-type')
        .setDescription('DNS record type.')
        .setRequired(true)
        .addChoices(...recordTypes.map((type) => ({ name: type, value: type })))
    )
    .addStringOption((option) =>
      option.setName('record-value').setDescription('DNS target/content.').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Briefly describe the project.').setRequired(true)
    )
    .addIntegerOption((option) =>
      option.setName('ttl').setDescription('DNS TTL in seconds. Defaults to 3600.').setRequired(false)
    )
    .addBooleanOption((option) =>
      option.setName('proxied').setDescription('Request Cloudflare proxying.').setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const sessions = await getCollection(collectionName);
    const userId = interaction.user.id;
    const session = await sessions.findOne({ userId });

    if (!session?.apiKey) {
      await interaction.editReply('You need to /login first to link your Open Domains account.');
      return;
    }

    const request = {
      subdomain: interaction.options.getString('subdomain', true).trim().toLowerCase(),
      root_domain: interaction.options.getString('root-domain', true).trim().toLowerCase(),
      record_type: interaction.options.getString('record-type', true),
      record_value: interaction.options.getString('record-value', true).trim(),
      ttl: interaction.options.getInteger('ttl') ?? 3600,
      proxied: interaction.options.getBoolean('proxied') ?? false,
      reason: interaction.options.getString('reason', true).trim(),
    };

    try {
      const result = await submitSubdomainRequest(session.apiKey, request);
      const status = result.status ? ` Status: ${result.status}.` : '';
      const requestId = result.request_id ? ` Request ID: ${result.request_id}.` : '';
      await interaction.editReply(`Subdomain request submitted.${status}${requestId}`);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        await sessions.deleteOne({ userId });
        await interaction.editReply(
          'Your stored Open Domains API key is no longer valid. Please /login again.'
        );
        return;
      }

      await interaction.editReply(`Unable to submit request: ${error.message}`);
    }
  },
};
