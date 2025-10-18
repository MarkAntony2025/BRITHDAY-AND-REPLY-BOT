const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
    new SlashCommandBuilder()
        .setName('setbirthday')
        .setDescription('Set your birthday')
        .addStringOption(option =>
            option.setName('date')
                  .setDescription('Your birthday in YYYY-MM-DD format')
                  .setRequired(true)
        )
        .toJSON(),

    new SlashCommandBuilder()
        .setName('checkbirthday')
        .setDescription('Check your or someone else’s birthday')
        .addUserOption(option =>
            option.setName('user')
                  .setDescription('Select a user to check their birthday')
                  .setRequired(false)
        )
        .toJSON(),

    new SlashCommandBuilder()
        .setName('birthdaylist')
        .setDescription('List all birthdays in the server')
        .toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Refreshing application (/) commands...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );
        console.log('Commands registered successfully!');
    } catch (error) {
        console.error(error);
    }
})();

