/**
 * Gemini MCP Server (HTTP / Remote)
 * Працює як віддалений сервер — доступний з будь-якого пристрою.
 * Підходить для claude.ai/code на комп'ютері і телефоні.
 *
 * Як працює:
 *   Claude отримує питання → викликає ask_gemini() →
 *   Gemini відповідає → Claude порівнює обидві думки → дає тобі фінал
 */

import http from "http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 3000;
// Необов'язковий секрет для захисту сервера (рекомендовано)
const AUTH_TOKEN = process.env.AUTH_TOKEN;

if (!GEMINI_API_KEY) {
  console.error("❌ Потрібна змінна середовища GEMINI_API_KEY");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- Інструменти ---

function buildServer() {
  const server = new Server(
    { name: "gemini-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "ask_gemini",
        description:
          "Запитай Gemini і отримай його незалежну думку. " +
          "Використовуй коли хочеш другу думку щодо архітектури, вибору підходу, " +
          "або коли задача неоднозначна. Потім порівняй відповіді і дай користувачу синтез.",
        inputSchema: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description: "Питання або задача для Gemini (укр або англ)",
            },
            context: {
              type: "string",
              description:
                "Додатковий контекст: код, опис проекту, обмеження (необов'язково)",
            },
          },
          required: ["question"],
        },
      },
      {
        name: "gemini_review_code",
        description:
          "Попроси Gemini зробити код-рев'ю. Він знайде баги, проблеми з безпекою " +
          "або запропонує покращення незалежно від Claude.",
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "Код для рев'ю",
            },
            goal: {
              type: "string",
              description: "Що цей код має робити / на що звернути увагу",
            },
          },
          required: ["code"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "ask_gemini") {
      const prompt = args.context
        ? `Контекст:\n${args.context}\n\nПитання:\n${args.question}`
        : args.question;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      return {
        content: [{ type: "text", text: `**Gemini відповідає:**\n\n${text}` }],
      };
    }

    if (name === "gemini_review_code") {
      const prompt =
        `Зроби код-рев'ю. Знайди баги, проблеми з безпекою, неефективні місця.\n` +
        `${args.goal ? `Мета коду: ${args.goal}\n` : ""}` +
        `\nКод:\n\`\`\`\n${args.code}\n\`\`\``;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      return {
        content: [{ type: "text", text: `**Gemini Code Review:**\n\n${text}` }],
      };
    }

    throw new Error(`Невідомий інструмент: ${name}`);
  });

  return server;
}

// --- HTTP сервер з SSE транспортом ---

const httpServer = http.createServer(async (req, res) => {
  // Перевірка токена (якщо AUTH_TOKEN встановлено)
  if (AUTH_TOKEN) {
    const token =
      req.headers["authorization"]?.replace("Bearer ", "") ||
      new URL(req.url, "http://x").searchParams.get("token");
    if (token !== AUTH_TOKEN) {
      res.writeHead(401, { "Content-Type": "text/plain" });
      res.end("Unauthorized");
      return;
    }
  }

  // Health check
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", name: "gemini-mcp" }));
    return;
  }

  // SSE endpoint для MCP
  if (req.url?.startsWith("/sse")) {
    const server = buildServer();
    const transport = new SSEServerTransport("/message", res);
    await server.connect(transport);
    return;
  }

  // Message endpoint (SSE transport надсилає сюди повідомлення)
  if (req.url?.startsWith("/message")) {
    // Обробляється автоматично через SSEServerTransport
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

httpServer.listen(PORT, () => {
  console.log(`✅ Gemini MCP сервер запущено на порту ${PORT}`);
  console.log(`   SSE endpoint: http://localhost:${PORT}/sse`);
  if (AUTH_TOKEN) {
    console.log("   Захист токеном: увімкнено");
  } else {
    console.log("   Захист токеном: вимкнено (рекомендуємо встановити AUTH_TOKEN)");
  }
});
