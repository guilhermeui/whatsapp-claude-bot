const express = require("express");
const axios = require("axios");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Verificacao do Webhook (Meta exige isso na configuracao)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado com sucesso!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Recebe mensagens do WhatsApp
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object !== "whatsapp_business_account") return res.sendStatus(404);

  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const messages = value?.messages;

  if (!messages || messages.length === 0) return res.sendStatus(200);

  const msg = messages[0];
  const from = msg.from;
  const text = msg.text?.body;

  if (!text) return res.sendStatus(200);

  console.log("Mensagem recebida de " + from + ": " + text);

  try {
    const claudeResponse = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: text }],
    });

    const reply = claudeResponse.content[0].text;

    await axios.post(
      "https://graph.facebook.com/v18.0/" + PHONE_NUMBER_ID + "/messages",
      {
        messaging_product: "whatsapp",
        to: from,
        type: "text",
        text: { body: reply },
      },
      {
        headers: {
          Authorization: "Bearer " + WHATSAPP_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Resposta enviada para " + from);
    res.sendStatus(200);
  } catch (error) {
    console.error("Erro:", error.message);
    res.sendStatus(500);
  }
});

app.get("/", (req, res) => res.send("Bot WhatsApp + Claude esta rodando!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando na porta " + PORT));
