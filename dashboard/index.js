const express = require("express");
const url = require("url");
const path = require("path");
const Discord = require("discord.js");
const ejs = require("ejs");
const passort = require("passport");
const bodyParser = require("body-parser");
const Strategy = require("passport-discord").Strategy;
const BotConfig = require("../config.json");
const Settings = require("./settings.json");
const passport = require("passport");
const prefixModel = require("../models/prefix");
const chatbotModel = require("../models/chatbot");

module.exports = (client) => {
  //WEBSITE CONFIG BACKEND
  const app = express();
  const session = require("express-session");
  const MemoryStore = require("memorystore")(session);

  //Initalize the Discord Login
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));
  passport.use(
    new Strategy(
      {
        clientID: Settings.config.clientID,
        clientSecret: process.env.SECRET || Settings.config.secret,
        callbackURL: Settings.config.callback,
        scope: ["identify", "guilds", "guilds.join"],
      },
      (accessToken, refreshToken, profile, done) => {
        process.nextTick(() => done(null, profile));
      }
    )
  );

  app.use(
    session({
      store: new MemoryStore({ checkPeriod: 86400000 }),
      secret: `#@%#&^$^$%@$^$&%#$%@#$%$^%&$%^#$%@#$%#E%#%@$FEErfgr3g#%GT%536c53cc6%5%tv%4y4hrgrggrgrgf4n`,
      resave: false,
      saveUninitialized: false,
    })
  );

  // MIDDLEWARES
  app.use(passport.initialize());
  app.use(passport.session());

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "./views"));

  app.use(bodyParser.json());
  app.use(
    bodyParser.urlencoded({
      extended: true,
    })
  );
  app.use(express.json());
  app.use(
    express.urlencoded({
      extended: true,
    })
  );
  //Loading css files
  app.use(express.static(path.join(__dirname, "./public")));

  const checkAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    req.session.backURL = req.url;
    res.redirect("/login");
  };
  app.get(
    "/login",
    (req, res, next) => {
      if (req.session.backURL) {
        req.session.backURL = req.session.backURL;
      } else if (req.headers.referer) {
        const parsed = url.parse(req.headers.referer);
        if (parsed.hostname == app.locals.domain) {
          req.session.backURL = parsed.path;
        }
      } else {
        req.session.backURL = "/";
      }
      next();
    },
    passport.authenticate("discord", { prompt: "none" })
  );

  app.get(
    "/callback",
    passport.authenticate("discord", { failureRedirect: "/" }),
    async (req, res) => {
      let banned = false; //client.settings.get("bannedusers")
      if (banned) {
        req.session.destroy();
        res.json({
          login: false,
          message: "You are banned from the dashboard",
          logout: true,
        });
        req.logout();
      } else {
        res.redirect("/dashboard");
      }
    }
  );

  app.get("/logout", function (req, res) {
    req.session.destroy(() => {
      req.logout();
      res.redirect("/");
    });
  });

  app.get("/", (req, res) => {
    res.render("index", {
      req: req,
      user: req.isAuthenticated() ? req.user : null,
      bot: client,
      Permissions: Discord.Permissions,
      botconfig: Settings.website,
      callback: Settings.config.callback,
    });
  });

  app.get("/commands", (req, res) => {
    res.render("commands", {
      req: req,
      user: req.isAuthenticated() ? req.user : null,
      bot: client,
      Permissions: Discord.Permissions,
      botconfig: Settings.website,
      callback: Settings.config.callback,
      commands: client.commands,
      categories: client.categories,
    });
  });

  app.get("/dashboard", (req, res) => {
    if (!req.isAuthenticated() || !req.user) return res.redirect("/login");
    if (!req.user.guilds)
      return res.redirect("/?error=" + encodeURIComponent("CANNOT_GET_GUILDS"));
    res.render("dashboard", {
      req: req,
      user: req.isAuthenticated() ? req.user : null,
      bot: client,
      Permissions: Discord.Permissions,
      botconfig: Settings.website,
      callback: Settings.config.callback,
    });
  });

  app.get("/dashboard/:guildID", checkAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildID);
    if (!guild)
      return res.redirect(
        "/?error=" +
          encodeURIComponent(
            "I am not in this Guild yet, please add me before!"
          )
      );
    let member = guild.members.cache.get(req.user.id);
    if (!member) {
      try {
        member = await guild.members.fetch(req.user.id);
      } catch {}
    }
    if (!member)
      return res.redirect(
        "/?error=" +
          encodeURIComponent("Login first please! / Join the Guild again!")
      );
    if (!member.permissions.has(Discord.Permissions.FLAGS.MANAGE_GUILD))
      return res.redirect(
        "/?error=" + encodeURIComponent("You are not allowed to do that")
      );
    res.render("settings", {
      req: req,
      user: req.isAuthenticated() ? req.user : null,
      guild: guild,
      bot: client,
      Permissions: Discord.Permissions,
      botconfig: Settings.website,
      callback: Settings.config.callback,
      prefix: await prefixModel.findOne({ Guild: guild.id }),
      chatbot: await chatbotModel.findOne({
        Guild: guild.id,
      }),
    });
  });

  app.post("/dashboard/:guildID", checkAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildID);
    if (!guild)
      return res.redirect(
        "/?error=" +
          encodeURIComponent(
            "I am not in this Guild yet, please add me before!"
          )
      );
    let member = guild.members.cache.get(req.user.id);
    if (!member) {
      try {
        member = await guild.members.fetch(req.user.id);
      } catch {}
    }
    if (!member)
      return res.redirect(
        "/?error=" +
          encodeURIComponent("Login first please! / Join the Guild again!")
      );
    if (!member.permissions.has(Discord.Permissions.FLAGS.MANAGE_GUILD))
      return res.redirect(
        "/?error=" + encodeURIComponent("You are not allowed to do that")
      );
    if (req.body.prefix)
      await prefixModel.findOneAndUpdate(
        {
          Guild: guild.id,
        },
        {
          Prefix: req.body.prefix,
        },
        {
          upsert: true,
        }
      );
    if (req.body.chatbot)
      await chatbotModel.findOneAndUpdate(
        {
          Guild: guild.id,
        },
        {
          Channel: req.body.chatbot,
        },
        {
          upsert: true,
        }
      );
    res.render("settings", {
      req: req,
      user: req.isAuthenticated() ? req.user : null,
      guild: guild,
      bot: client,
      Permissions: Discord.Permissions,
      botconfig: Settings.website,
      callback: Settings.config.callback,
      prefix: await prefixModel.findOne({
        Guild: guild.id,
      }),
      chatbot: await chatbotModel.findOne({
        Guild: guild.id,
      }),
    });
  });

  app.get("/invite", async (req, res) => {
    res.redirect(
      `https://discordapp.com/oauth2/authorize?client_id=${
        client.user.id
      }&scope=bot%20applications.commands&response_type=code&redirect_uri=${encodeURIComponent(
        Settings.config.callback
      )}&permissions=1075214`
    );
  });

  app.get("/invite/:guildID", async (req, res) => {
    res.redirect(
      `https://discordapp.com/oauth2/authorize?client_id=${
        client.user.id
      }&scope=bot%20applications.commands&guild_id=${
        req.params.guildID
      }&response_type=code&redirect_uri=${encodeURIComponent(
        Settings.config.callback
      )}&permissions=1075214`
    );
  });

  const http = require("http").createServer(app);
  http.listen(Settings.config.port, () => {
    console.log(`Website is online on port ${Settings.config.port}`);
  });
};