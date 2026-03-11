const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(express.json());

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is missing");
}

const bot = new TelegramBot(token);

app.get("/", (req, res) => {
  res.send("PowerInside bot is running");
});

app.post("/webhook", async (req, res) => {
  try {
    console.log("Incoming update:", JSON.stringify(req.body));
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(500);
  }
});

bot.onText(/\/start/, async (msg) => {
  try {
    await bot.sendMessage(
      msg.chat.id,
      "Вітаю! Це PowerInside Coach Interview Bot.\n\nНатисніть /interview щоб почати."
    );
  } catch (error) {
    console.error("Send /start error:", error);
  }
});

bot.onText(/\/interview/, async (msg) => {
  try {
    await bot.sendMessage(
      msg.chat.id,
      "Раунд 1 з 7\n\nЯкий ваш тренерський досвід і у яких дисциплінах ви працюєте?"
    );
  } catch (error) {
    console.error("Send /interview error:", error);
  }
});

bot.on("message", (msg) => {
  console.log("Message received:", msg.text || "[non-text]");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
