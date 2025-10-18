const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
require('dotenv').config();
const fs = require('fs');
const cron = require('node-cron');

// ----------------------
// Express server for Render
// ----------------------
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Express server listening on port ${PORT}`));

// ----------------------
// Discord Client
// ----------------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ----------------------
// Config
// ----------------------
const GUILD_ID = process.env.GUILD_ID;
const BIRTHDAY_CHANNEL_ID = process.env.BIRTHDAY_CHANNEL_ID;
const BIRTHDAY_ROLE_ID = process.env.BIRTHDAY_ROLE_ID;
const BUSY_USER_IDS = process.env.BUSY_USER_IDS.split(',').map(id => id.trim());
const REPLY_MESSAGE = "He is busy";

// ----------------------
// Birthdays storage
// ----------------------
const BIRTHDAY_FILE = './birthdays.json';
let birthdays = {};
if (fs.existsSync(BIRTHDAY_FILE)) birthdays = JSON.parse(fs.readFileSync(BIRTHDAY_FILE));
function saveBirthdays() { fs.writeFileSync(BIRTHDAY_FILE, JSON.stringify(birthdays, null, 2)); }

// ----------------------
// Bot Ready
// ----------------------
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);

    // Birthday check at 12:00 AM daily
    cron.schedule('0 0 * * *', async () => {
        const today = new Date();
        const todayStr = `${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        const guild = client.guilds.cache.get(GUILD_ID);
        const channel = client.channels.cache.get(BIRTHDAY_CHANNEL_ID);
        if (!guild || !channel) return;

        for (const [userId, date] of Object.entries(birthdays)) {
            const [year, month, day] = date.split('-');
            if (`${month}-${day}` !== todayStr) continue;

            try {
                const member = await guild.members.fetch(userId);
                if (!member) continue;

                // Give birthday role
                if (BIRTHDAY_ROLE_ID) {
                    await member.roles.add(BIRTHDAY_ROLE_ID);
                    setTimeout(async () => {
                        await member.roles.remove(BIRTHDAY_ROLE_ID).catch(console.error);
                    }, 24*60*60*1000);
                }

                // Send birthday message
                const gifURL = 'https://media.giphy.com/media/3o6ZtaO9BZHcOjmErm/giphy.gif';
                channel.send({
                    content: `@everyone 🎉 Happy Birthday <@${userId}>! 🎂🥳`,
                    embeds: [{ image: { url: gifURL }, color: 0xff69b4 }]
                });

            } catch (err) { console.error(err); }
        }
    }, { timezone: "Asia/Kolkata" });
});

// ----------------------
// Slash commands
// ----------------------
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    if (commandName === 'setbirthday') {
        const date = interaction.options.getString('date');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
            return interaction.reply({ content: 'Use YYYY-MM-DD format', ephemeral: true });

        birthdays[interaction.user.id] = date;
        saveBirthdays();
        return interaction.reply({ content: `Your birthday set to ${date}`, ephemeral: true });
    }

    if (commandName === 'checkbirthday') {
        const user = interaction.options.getUser('user') || interaction.user;
        const date = birthdays[user.id];
        if (!date) return interaction.reply({ content: `No birthday found for ${user.tag}`, ephemeral: true });
        return interaction.reply({ content: `${user.tag}'s birthday is on ${date}`, ephemeral: true });
    }

    if (commandName === 'birthdaylist') {
        const guild = interaction.guild;
        if (!guild) return interaction.reply({ content: 'Guild not found', ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle('🎂 Birthday List 🎂')
            .setColor(0xff69b4)
            .setDescription('All birthdays in this server:');

        const sorted = Object.entries(birthdays).sort((a,b)=>{
            const [aM,aD] = a[1].split('-').slice(1);
            const [bM,bD] = b[1].split('-').slice(1);
            return aM !== bM ? aM - bM : aD - bD;
        });

        for(const [userId,date] of sorted){
            const member = await guild.members.fetch(userId).catch(()=>null);
            if(member) embed.addFields({name: member.user.tag,value: date,inline:true});
        }

        interaction.reply({ embeds: [embed], ephemeral: false });
    }
});

// ----------------------
// Auto-reply “He is busy”
// ----------------------
client.on('messageCreate', (message) => {
    if(message.author.bot) return;
    if(message.type === 19 && message.mentions.users.some(u => BUSY_USER_IDS.includes(u.id))) return;

    const mentionedTarget = message.mentions.users.find(u => BUSY_USER_IDS.includes(u.id));
    if(mentionedTarget) message.reply(REPLY_MESSAGE);
});

// ----------------------
// Login Bot
// ----------------------
client.login(process.env.TOKEN);


