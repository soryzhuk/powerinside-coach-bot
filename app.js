const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is missing");
}

const bot = new TelegramBot(token);

const PROMPT_PATH = path.join(__dirname, "prompts", "coach_interview.txt");
const SUMMARY_PROMPT_PATH = path.join(__dirname, "prompts", "round_summary.txt");

function readPrompt(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error("Prompt read error:", error);
    return "";
  }
}

const coachInterviewPrompt = readPrompt(PROMPT_PATH);
const roundSummaryPrompt = readPrompt(SUMMARY_PROMPT_PATH);

// Simple in-memory session storage for MVP
const sessions = new Map();

const rounds = [
  "ROUND 1 — TARGET ATHLETE",
  "ROUND 2 — LOAD MANAGEMENT",
  "ROUND 3 — AUTOREGULATION",
  "ROUND 4 — PROGRESSION AND DELOAD",
  "ROUND 5 — EXERCISE SELECTION",
  "ROUND 6 — TECHNIQUE STANDARDS",
  "ROUND 7 — LIFESTYLE AND RECOVERY"
];

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      started: false,
      currentRound: 0,
      answers: [],
      interviewStarted: false
    });
  }
  return sessions.get(chatId);
}

app.get("/", (req, res) => {
  res.send("PowerInside bot is running");
});

app.post("/webhook", async (req, res) => {
  try {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(500);
  }
});

bot.onText(/\/start/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const session = getSession(chatId);

    session.started = true;
    session.interviewStarted = false;
    session.currentRound = 0;
    session.answers = [];

    await bot.sendMessage(
      chatId,
      "Вітаю! Це PowerInside Coach Interview Bot.\n\nНатисніть /interview щоб почати."
    );
  } catch (error) {
    console.error("Send /start error:", error);
  }
});

bot.onText(/\/interview/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const session = getSession(chatId);

    session.interviewStarted = true;
    session.currentRound = 0;
    session.answers = [];

    await bot.sendMessage(
      chatId,
      "Починаємо інтерв’ю.\n\nЦе не тест і не екзамен. Мені важливо зрозуміти, як ви реально працюєте з атлетами на практиці.\n\nСпершу коротке warm-up питання.\n\nЯк ви прийшли у тренерську діяльність?"
    );
  } catch (error) {
    console.error("Send /interview error:", error);
  }
});

bot.onText(/\/round/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const session = getSession(chatId);

    if (!session.interviewStarted) {
      await bot.sendMessage(chatId, "Спершу натисніть /interview");
      return;
    }

    const roundTitle = rounds[session.currentRound] || "Інтерв’ю завершено";
    await bot.sendMessage(chatId, `Поточний раунд:\n\n${roundTitle}`);
  } catch (error) {
    console.error("Send /round error:", error);
  }
});

bot.onText(/\/summary/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const session = getSession(chatId);

    if (!session.answers.length) {
      await bot.sendMessage(chatId, "Поки що немає даних для резюме.");
      return;
    }

    const lastRoundAnswers = session.answers
      .filter((item) => item.round === session.currentRound)
      .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
      .join("\n\n");

    const summaryText =
      `ROUND SUMMARY\n\n` +
      `Round: ${rounds[session.currentRound] || "Unknown"}\n\n` +
      `Prompt template loaded: ${roundSummaryPrompt ? "yes" : "no"}\n\n` +
      `${lastRoundAnswers || "Немає відповідей у цьому раунді."}`;

    await bot.sendMessage(chatId, summaryText.slice(0, 4000));
  } catch (error) {
    console.error("Send /summary error:", error);
  }
});

bot.on("message", async (msg) => {
  try {
    const chatId = msg.chat.id;
    const text = msg.text || "";

    if (text.startsWith("/")) {
      return;
    }

    const session = getSession(chatId);

    if (!session.interviewStarted) {
      return;
    }

    const currentRoundTitle = rounds[session.currentRound] || "ROUND 1 — TARGET ATHLETE";

    let nextQuestion = "";

    if (session.currentRound === 0) {
      if (session.answers.filter((a) => a.round === 0).length === 0) {
        session.answers.push({
          round: 0,
          question: "Як ви прийшли у тренерську діяльність?",
          answer: text
        });

        nextQuestion =
          "Дякую.\n\nЧи працюєте ви за конкретною системою / framework, чи здебільшого адаптуєте тренування під атлета і ситуацію?";
      } else if (session.answers.filter((a) => a.round === 0).length === 1) {
        session.answers.push({
          round: 0,
          question: "Чи працюєте ви за конкретною системою / framework, чи здебільшого адаптуєте тренування під атлета і ситуацію?",
          answer: text
        });

        nextQuestion =
          "Ще одне важливе питання перед основним раундом.\n\nЯкби інший досвідчений тренер подивився на одне ваше тренування, що одразу показало б, що це саме ваша система, а не чиясь інша?";
      } else if (session.answers.filter((a) => a.round === 0).length === 2) {
        session.answers.push({
          round: 0,
          question: "Що робить ваш підхід впізнаваним?",
          answer: text
        });

        nextQuestion =
          "ROUND 1 — TARGET ATHLETE\n\nЩоб правильно зрозуміти вашу систему, мені важливо спочатку визначити, для якого типу атлета вона побудована.\n\nДля яких атлетів ваша система підходить найкраще?";
        session.currentRound = 1;
      }
    } else {
      session.answers.push({
        round: session.currentRound,
        question: currentRoundTitle,
        answer: text
      });

      nextQuestion =
        `Відповідь збережена.\n\nПоточний раунд:\n${currentRoundTitle}\n\n` +
        `Промпт завантажено: ${coachInterviewPrompt ? "так" : "ні"}\n\n` +
        `Щоб рухатись далі професійно, наступним кроком ми додамо OpenAI API і повну логіку раундів.`;
    }

    if (nextQuestion) {
      await bot.sendMessage(chatId, nextQuestion.slice(0, 4000));
    }
  } catch (error) {
    console.error("Message handler error:", error);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
  console.log("Coach interview prompt loaded:", !!coachInterviewPrompt);
  console.log("Round summary prompt loaded:", !!roundSummaryPrompt);
});
