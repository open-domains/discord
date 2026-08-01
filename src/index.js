import 'dotenv/config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { getCollection } from './lib/mongo.js';
import { loadCommands } from './lib/command-loader.js';
import { formatAgentResponse, getAgentName, getBase44Client } from './lib/base44-agent.js';

const token = process.env.DISCORD_TOKEN;
const ticketCategoryId = process.env.TICKET_CATEGORY_ID || '1383178711511072928';
const closedTicketCategoryId = process.env.CLOSED_TICKET_CATEGORY_ID || '1383178786756890826';

if (!token) {
  throw new Error('Missing DISCORD_TOKEN in environment.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const commands = await loadCommands();

async function getNextCaseNumber(guild) {
  const channels = await guild.channels.fetch();
  const ticketChannels = channels.filter((channel) => channel?.type === ChannelType.GuildText && channel.name.includes('ticket-'));

  const numbers = ticketChannels
    .map((channel) => {
      const match = channel.name.match(/-(\d+)$/);
      return match ? Number(match[1]) : null;
    })
    .filter((value) => Number.isInteger(value));

  return numbers.length ? Math.max(...numbers) + 1 : 1001;
}

async function hasActiveTicket(guild, userId) {
  const channels = await guild.channels.fetch();

  return channels.some((channel) => {
    if (!channel || channel.type !== ChannelType.GuildText) return false;
    if (channel.parentId !== ticketCategoryId) return false;
    if (!channel.name.startsWith('ticket-')) return false;

    const overwrite = channel.permissionOverwrites.cache.get(userId);
    return Boolean(overwrite?.allow.has(PermissionFlagsBits.ViewChannel));
  });
}

async function createTicketChannel(guild, user) {
  const category = await guild.channels.fetch(ticketCategoryId).catch(() => null);

  if (!category || category.type !== ChannelType.GuildCategory) {
    throw new Error(`Ticket category ${ticketCategoryId} was not found.`);
  }

  const hasOpenTicket = await hasActiveTicket(guild, user.id);
  if (hasOpenTicket) {
    throw new Error('You already have an open ticket. Please close the existing one before opening a new one.');
  }

  const caseNumber = await getNextCaseNumber(guild);
  const baseName = user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 70);
  const channelName = `${baseName}-${caseNumber}`;

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `Support ticket for ${user.tag}`,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AddReactions,
        ],
      },
    ],
  });

  return channel;
}

async function closeTicketChannel(channel, user) {
  const closedCategory = await channel.guild.channels.fetch(closedTicketCategoryId).catch(() => null);

  if (!closedCategory || closedCategory.type !== ChannelType.GuildCategory) {
    throw new Error(`Closed ticket category ${closedTicketCategoryId} was not found.`);
  }

  if (channel.parentId === closedCategory.id) {
    return { alreadyClosed: true };
  }

  await channel.setParent(closedCategory.id, { lockPermissions: false });

  await channel.permissionOverwrites.edit(user.id, {
    SendMessages: false,
    AddReactions: false,
    AttachFiles: false,
    EmbedLinks: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false,
  });

  return { alreadyClosed: false };
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);

  readyClient.user.setPresence({
    activities: [{ name: 'OpenDomains Management system' }],
    status: 'online',
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) {
      console.warn(`No handler registered for /${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);

      const reply = {
        content: 'There was an error while executing this command.',
        ephemeral: true,
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }

    return;
  }

  if (interaction.isButton() && interaction.customId === 'open_ticket') {
    const modal = new ModalBuilder()
      .setCustomId('ticket_modal')
      .setTitle('Open a support ticket');

    const summaryInput = new TextInputBuilder()
      .setCustomId('ticket_summary')
      .setLabel('What do you need help with?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const categoryInput = new TextInputBuilder()
      .setCustomId('ticket_category')
      .setLabel('Account or domain issue?')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(summaryInput),
      new ActionRowBuilder().addComponents(categoryInput)
    );

    await interaction.showModal(modal);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
    try {
      if (!interaction.inGuild()) {
        await interaction.reply({ content: 'Tickets can only be created inside a server.', ephemeral: true });
        return;
      }

      const summary = interaction.fields.getTextInputValue('ticket_summary').trim();
      const category = interaction.fields.getTextInputValue('ticket_category').trim();
      const ticketChannel = await createTicketChannel(interaction.guild, interaction.user);

      const embed = new EmbedBuilder()
        .setTitle('New support ticket')
        .setDescription('A new support ticket has been opened.')
        .setColor(0x5865f2)
        .addFields(
          { name: 'Summary', value: summary || 'No summary provided.', inline: false },
          { name: 'Category', value: category || 'Unspecified', inline: false }
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`close_ticket:${ticketChannel.id}`)
          .setLabel('Close ticket')
          .setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({
        content: `${interaction.user} thanks for opening a ticket. Please answer the questions below so we can categorize this properly.`,
        embeds: [embed],
        components: [row],
      });

      await ticketChannel.send({
        content: [
          'Please reply with a bit more detail so we can help you faster.',
          '1. What is the issue about?',
          '2. What category or urgency best fits this request?',
        ].join('\n'),
      });

      await interaction.reply({
        content: `Your ticket channel is ready: <#${ticketChannel.id}>`,
        ephemeral: true,
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: `Unable to create your ticket right now: ${error.message}`,
        ephemeral: true,
      });
    }
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('close_ticket:')) {
    try {
      const [, channelId] = interaction.customId.split(':');
      const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);

      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.reply({ content: 'This ticket channel could not be found.', ephemeral: true });
        return;
      }

      const result = await closeTicketChannel(channel, interaction.user);

      if (result.alreadyClosed) {
        await interaction.reply({ content: 'This ticket is already closed.', ephemeral: true });
        return;
      }

      await channel.send({
        content: `Ticket closed by ${interaction.user}. This channel is now read-only.`,
      });

      await interaction.reply({ content: 'Ticket closed successfully.', ephemeral: true });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: `Unable to close this ticket: ${error.message}`, ephemeral: true });
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.inGuild()) return;
  if (!message.reference?.messageId) return;
  if (!message.member?.roles?.cache?.has('1055639336286175274')) return;
  
  const content = message.content?.trim();
  if (!content) return;

  const sessions = await getCollection('sessions');
  const existing = await sessions.findOne({ messageId: message.reference.messageId });

  if (!existing?.conversationId) {
    return;
  }

  try {
    const base44 = getBase44Client();
    await base44.agents.addMessage(
      { id: existing.conversationId },
      {
        role: 'user',
        content,
      }
    );

    const refreshedConversation = await base44.agents.getConversation(existing.conversationId);
    const latestAssistantMessage = [...(refreshedConversation?.messages ?? [])]
      .reverse()
      .find((entry) => entry.role === 'assistant' && entry.content);
    const agentReply = formatAgentResponse(latestAssistantMessage?.content);

    await message.reply(agentReply ? `Forwarded to the agent. ${agentReply}`.trim() : 'Forwarded to the agent.');
  } catch (error) {
    console.error(error);
    await message.reply(`Unable to forward your message to the agent: ${error.message}`);
  }
});

client.login(token);
