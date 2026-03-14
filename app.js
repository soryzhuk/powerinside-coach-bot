const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!telegramToken) {
  console.error("TELEGRAM_BOT_TOKEN is missing");
}
if (!openaiApiKey) {
  console.error("OPENAI_API_KEY is missing");
}

const bot = new TelegramBot(telegramToken);
const openai = new OpenAI({ apiKey: openaiApiKey });

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

const sessions = new Map();

const rounds = [
  "PRE-INTERVIEW",
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
      interviewStarted: false,
      currentRound: 0,
      history: []
    });
  }
  return sessions.get(chatId);
}

function trimHistory(history, maxItems = 20) {
  return history.slice(-maxItems);
}

async function askModel(session, userMessage) {
  const historyText = trimHistory(session.history)
    .map((item) => `${item.role.toUpperCase()}: ${item.text}`)
    .join("\n\n");

  const systemPrompt = `${coachInterviewPrompt}

CURRENT ROUND:
${rounds[session.currentRound] || "UNKNOWN"}

IMPORTANT:
- Speak in the coach's language.
- Ask only one question per message.
- Stay strictly within the current round.
- If the current round has enough information, produce a Round Summary and pause.
- Do not start the next round automatically.
`;

  const userPrompt = `Conversation so far:

${historyText}

Latest coach message:
${userMessage}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.4,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  return response.choices[0].message.content.trim();
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
    sessions.set(chatId, {
      interviewStarted: false,
      currentRound: 0,
      history: []
    });

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
    session.history = [];

    const openingMessage =
      "Вітаю. Це інтерв’ю є частиною проєкту PowerInside.\n\n" +
      "Це не тест і не екзамен. Мені важливо зрозуміти, як ви реально працюєте з атлетами на практиці.\n\n" +
      "Будемо рухатися крок за кроком, по одному питанню.\n\n" +
      "Почнемо з короткого warm-up питання.\n\n" +
      "Як ви прийшли у тренерську діяльність?";

    session.history.push({ role: "assistant", text: openingMessage });

    await bot.sendMessage(chatId, openingMessage);
  } catch (error) {
    console.error("Send /interview error:", error);
  }
});

bot.onText(/\/round/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const session = getSession(chatId);

    await bot.sendMessage(
      chatId,
      `Поточний раунд:\n${rounds[session.currentRound] || "UNKNOWN"}`
    );
  } catch (error) {
    console.error("Send /round error:", error);
  }
});

bot.onText(/\/next/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const session = getSession(chatId);

    if (session.currentRound < 7) {
      session.currentRound += 1;
      await bot.sendMessage(
        chatId,
        `Переходимо далі.\n\nПоточний раунд:\n${rounds[session.currentRound]}`
      );
    } else {
      await bot.sendMessage(chatId, "Усі 7 раундів уже завершено.");
    }
  } catch (error) {
    console.error("Send /next error:", error);
  }
});

bot.onText(/\/summary/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const session = getSession(chatId);

    const historyText = trimHistory(session.history, 30)
      .map((item) => `${item.role.toUpperCase()}: ${item.text}`)
      .join("\n\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: roundSummaryPrompt },
        {
          role: "user",
          content: `Current round: ${rounds[session.currentRound]}\n\nConversation:\n\n${historyText}`
        }
      ]
    });

    const summary = response.choices[0].message.content.trim();
    await bot.sendMessage(chatId, summary.slice(0, 4000));
  } catch (error) {
    console.error("Send /summary error:", error);
    await bot.sendMessage(msg.chat.id, "Не вдалося сформувати резюме раунду.");
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

    session.history.push({ role: "user", text });

    const reply = await askModel(session, text);

    session.history.push({ role: "assistant", text: reply });

    await bot.sendMessage(chatId, reply.slice(0, 4000));
  } catch (error) {
    console.error("Message handler error:", error);
    await bot.sendMessage(
      msg.chat.id,
      "Сталася помилка під час обробки повідомлення. Спробуйте ще раз."
    );
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
  console.log("Coach interview prompt loaded:", !!coachInterviewPrompt);
  console.log("Round summary prompt loaded:", !!roundSummaryPrompt);
});
