import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import dotenv from "dotenv";
import express from "express";
import schedule from "node-schedule";
import fs from "fs";

dotenv.config();

// ================= SERVER (Render keep-alive) =================
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("✅ Birthday bot is running"));
app.listen(PORT, () => console.log(`🌐 Web server on port ${PORT}`));

// ================= DISCORD SETUP =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

const BIRTHDAY_CHANNEL_ID = process.env.BIRTHDAY_CHANNEL_ID;
const BIRTHDAY_ROLE_ID = process.env.BIRTHDAY_ROLE_ID;
const TARGET_USER_ID = process.env.TARGET_USER_ID;

let busyMode = false;

// =============== Load / Save Birthdays ===============
const FILE = "./birthdays.json";
let BIRTHDAYS = {};

if (fs.existsSync(FILE)) {
  BIRTHDAYS = JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function saveBirthdays() {
  fs.writeFileSync(FILE, JSON.stringify(BIRTHDAYS, null, 2));
}

// =============== Slash Commands ===============
const commands = [
  new SlashCommandBuilder()
    .setName("setbirthday")
    .setDescription("Set your birthday (format: DD-MM-YYYY)")
    .addStringOption((opt) =>
      opt
        .setName("date")
        .setDescription("Enter your birthday (DD-MM-YYYY)")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("birthdaylist")
    .setDescription("Show all saved birthdays"),
  new SlashCommandBuilder()
    .setName("busy")
    .setDescription("Toggle busy auto-reply (target user only)"),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show help menu"),
].map((cmd) => cmd.toJSON());

// =============== Register Commands ===============
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("📦 Registering slash commands...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });
    console.log("✅ Commands registered globally!");
  } catch (err) {
    console.error("❌ Command registration failed:", err);
  }
})();

// =============== Client Ready ===============
client.once("clientReady", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  schedule.scheduleJob("0 0 * * *", checkBirthdays); // every midnight
});

// =============== Interaction Commands ===============
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  const { commandName } = interaction;

  if (commandName === "setbirthday") {
    const dateStr = interaction.options.getString("date");
    const [day, month, year] = dateStr.split("-").map(Number);
    if (!day || !month || !year)
      return interaction.reply("❌ Invalid format! Use DD-MM-YYYY");

    const age = new Date().getFullYear() - year;
    BIRTHDAYS[interaction.user.id] = { date: dateStr, age };
    saveBirthdays();
    return interaction.reply(
      `🎉 Birthday set to **${dateStr}** (Age: ${age})`
    );
  }

  if (commandName === "birthdaylist") {
    if (Object.keys(BIRTHDAYS).length === 0)
      return interaction.reply("📭 No birthdays saved yet!");
    const list = Object.entries(BIRTHDAYS)
      .map(([id, { date, age }]) => `<@${id}> — 🎂 ${date} (${age} yrs)`)
      .join("\n");
    return interaction.reply(`🎈 **Birthday List:**\n${list}`);
  }

  if (commandName === "busy") {
    if (interaction.user.id !== TARGET_USER_ID)
      return interaction.reply("❌ Only the target user can toggle busy mode.");
    busyMode = !busyMode;
    return interaction.reply(`🕒 Busy mode is now **${busyMode ? "ON" : "OFF"}**`);
  }

  if (commandName === "help") {
    const helpMsg = `
📘 **Birthday Bot Commands**
/setbirthday DD-MM-YYYY → Save your birthday  
/birthdaylist → View all saved birthdays  
/busy → Toggle auto-reply (target user only)  
/help → Show this help message  
    `;
    return interaction.reply(helpMsg);
  }
});

// =============== Busy Auto Reply ===============
client.on("messageCreate", (message) => {
  if (message.author.bot || !busyMode) return;
  if (message.mentions.users.has(TARGET_USER_ID)) {
    message.reply("He is busy in job / Wait for reply or DM ");
  }
});

// =============== Birthday Checker ===============
async function checkBirthdays() {
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, "0")}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;

  for (const [userId, { date, age }] of Object.entries(BIRTHDAYS)) {
    if (date.startsWith(todayStr)) {
      const guild = client.guilds.cache.first();
      if (!guild) continue;
      const member = await guild.members.fetch(userId).catch(() => null);
      const channel = guild.channels.cache.get(BIRTHDAY_CHANNEL_ID);
      if (!member || !channel) continue;

      // Add birthday role
      await member.roles.add(BIRTHDAY_ROLE_ID).catch(() => {});
      // Send birthday message
      await channel.send(
        `🎉 Today is a very special day – we’re celebrating the birthday of ${member}! 🥳🎈\n\n` +
          `Wishing you a year filled with happiness, success, and endless joy. 💖✨\n` +
          `May all your dreams come true and your journey ahead be as amazing as you are! 🌟\n\n` +
          `Let’s all take a moment to drop our warmest wishes and make this day unforgettable for ${member}! 🎁🎉\n\n` +
          `🎂🍰🎶 Happy Birthday once again! 🎶🍰🎂`
      );
      // DM user
      await member.send(
        `🎂 Happy Birthday, ${member.displayName}! You turned ${age} today! 🎉`
      );
    }
  }
}

// =============== Login ===============
client.login(process.env.TOKEN);






