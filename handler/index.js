const { glob } = require("glob");
const { promisify } = require("util");
const { Client } = require("discord.js");
const mongoose = require("mongoose");

const globPromise = promisify(glob);

const path = require("path");
const fs = require("fs");

/**
 * @param {Client} client
 */
module.exports = async (client) => {
  // Commands
  const commandFiles = await globPromise(`${process.cwd()}/commands/**/*.js`);
  commandFiles.map((value) => {
    const file = require(value);
    const splitted = value.split("/");
    const directory = splitted[splitted.length - 2];

    if (file.name) {
      const properties = { directory, ...file };
      client.commands.set(file.name, properties);
    }
  });

  // Slash Commands
  const slashCommands = await globPromise(
    `${process.cwd()}/SlashCommands/*/*.js`
  );

  const arrayOfSlashCommands = [];
  slashCommands.map((value) => {
    const file = require(value);
    if (!file?.name) return;
    client.slashCommands.set(file.name, file);

    if (["MESSAGE", "USER"].includes(file.type)) delete file.description;
    arrayOfSlashCommands.push(file);
  });

  client.on("ready", async () => {
    if (process.env.TEST === "true") {
      await client.guilds.cache
        .get(process.env.testGuildID)
        .commands.set(arrayOfSlashCommands);
    } else {
      await client.application.commands.set(arrayOfSlashCommands);
    }
  });

  // Events
  const eventFiles = await globPromise(`${process.cwd()}/events/*.js`);
  eventFiles.map((value) => require(value));

  // Features
  // const readFeatures = (dir) => {
  //   const files = fs.readdirSync(path.join(__dirname, dir));
  //   for (const file of files) {
  //     const stat = fs.lstatSync(path.join(__dirname, dir, file));
  //     if (stat.isDirectory()) {
  //       readFeatures(path.join(dir, file));
  //     } else {
  //       const feature = require(path.join(__dirname, dir, file));
  //       feature(client);
  //     }
  //   }
  // };

  // readFeatures("../features/");

  // MongoDB
  const mongoURI = process.env.mongoURI;
  if (!mongoURI) return;

  mongoose.connect(mongoURI).then(() => console.log("Connected to MongoDB"));
};
