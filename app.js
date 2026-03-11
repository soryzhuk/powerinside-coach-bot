const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(express.json());

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);

app.get("/", (req, res) => {
  res.send("PowerInside bot is running");
});

app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    "Вітаю! Це PowerInside Coach Interview Bot.\n\nНатисніть /interview щоб почати."
  );
});

bot.onText(/\/interview/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    "Раунд 1 з 7\n\nЯкий ваш тренерський досвід і у яких дисциплінах ви працюєте?"
  );
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
