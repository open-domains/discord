import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import { getCollection } from '../lib/mongo.js';
import { pollForDeviceKey, startDeviceAuth } from '../lib/open-domains.js';

const collectionName = 'sessions';

function isActiveSession(session) {
  return Boolean(session?.apiKey);
}

export const command = {
  data: new SlashCommandBuilder()
    .setName('login')
    .setDescription('Authenticate with OpenDomains via device authorization.'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const sessions = await getCollection(collectionName);
    const userId = interaction.user.id;
    const existing = await sessions.findOne({ userId });

    if (isActiveSession(existing)) {
      await interaction.editReply(
        'You are already logged in. Use your existing session or /login again after it expires.'
      );
      return;
    }

    let device;

    try {
      device = await startDeviceAuth();
    } catch (error) {
      await interaction.editReply(`Unable to start login: ${error.message}`);
      return;
    }

    const expiresAt = device.expires_in
      ? new Date(Date.now() + device.expires_in * 1000)
      : undefined;

    await sessions.updateOne(
      { userId },
      {
        $set: {
          userId,
          status: 'pending',
          deviceCode: device.device_code,
          userCode: device.user_code,
          verificationUri: device.verification_uri,
          verificationUriComplete: device.verification_uri_complete,
          expiresAt,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    const verificationUrl = device.verification_uri_complete || device.verification_uri;
    const codeLine = device.user_code ? `Enter code **${device.user_code}**` : 'Approve the request';

    const loginMessage = [codeLine, 'This window will update once the login completes.'].join('\n');

    const components = verificationUrl
      ? [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Open login').setStyle(ButtonStyle.Link).setURL(verificationUrl)
          ),
        ]
      : [];

    await interaction.editReply({ content: loginMessage, components });

    try {
      const key = await pollForDeviceKey(device.device_code, {
        interval: device.interval,
        expiresIn: device.expires_in,
      });

      await sessions.updateOne(
        { userId },
        {
          $set: {
            status: 'authenticated',
            apiKey: key,
            updatedAt: new Date(),
          },
          $unset: {
            accessToken: true,
            refreshToken: true,
            tokenType: true,
            scope: true,
            tokenExpiresAt: true,
          },
        }
      );

      await interaction.followUp({
        content: '✅ Login complete. Your OpenDomains API key is stored securely.',
        ephemeral: true,
      });
    } catch (error) {
      await sessions.updateOne(
        { userId },
        {
          $set: { status: 'failed', lastError: error.message, updatedAt: new Date() },
        }
      );

      await interaction.followUp({
        content: `Login failed or expired: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};
