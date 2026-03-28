/**
 * Gemini MCP Server (HTTP / Remote)
 * Працює як віддалений сервер — доступний з будь-якого пристрою.
 * Підходить для claude.ai/code на комп'ютері і телефоні.
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
const AUTH_TOKEN = process.env.AUTH_TOKEN;
// Контекст проекту — вставляється в кожен запит до Gemini автоматично
const PROJECT_CONTEXT = process.env.PROJECT_CONTEXT || "";

if (!GEMINI_API_KEY) {
  console.error("❌ Потрібна змінна середовища GEMINI_API_KEY");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Gemini отримує системний промпт з контекстом проекту
// Це робить його повноцінним учасником розробки, а не просто відповідачем на питання
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  systemInstruction: `Ти — AI-асистент розробника у проекті NeverMind.

NeverMind — персональний PWA-агент продуктивності.
Стек: ванільний JavaScript, localStorage, GitHub Pages. Без фреймворків, без бекенду.
Мова UI: українська.

Твоя роль: давати незалежну технічну думку поруч з Claude.
- Аналізуй задачі критично і чесно
- Якщо бачиш ризики — говори прямо
- Пропонуй конкретні рішення, а не загальні поради
- Відповідай стисло і по суті

${PROJECT_CONTEXT ? `Додатковий контекст проекту:\n${PROJECT_CONTEXT}` : ""}`.trim(),
});

// --- MCP Server ---

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
          "ЗАВЖДИ передавай у context: поточну задачу, релевантний код або файли, обмеження проекту. " +
          "Gemini вже знає загальний контекст проекту — передавай специфіку поточної задачі.",
        inputSchema: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description: "Питання або задача для Gemini",
            },
            context: {
              type: "string",
              description:
                "Обов'язково: поточна задача + релевантний код/файли + обмеження. " +
                "Чим більше контексту — тим корисніша відповідь Gemini.",
            },
          },
          required: ["question", "context"],
        },
      },
      {
        name: "gemini_review_code",
        description:
          "Попроси Gemini зробити код-рев'ю. Знайде баги, проблеми з безпекою, неефективні місця.",
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "Код для рев'ю",
            },
            goal: {
              type: "string",
              description: "Що цей код має робити і на що звернути особливу увагу",
            },
            file_context: {
              type: "string",
              description: "Назва файлу і його роль в проекті (необов'язково але корисно)",
            },
          },
          required: ["code", "goal"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "ask_gemini") {
      const prompt = `Контекст поточної задачі:\n${args.context}\n\nПитання:\n${args.question}`;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return {
        content: [{ type: "text", text: `**Gemini:**\n\n${text}` }],
      };
    }

    if (name === "gemini_review_code") {
      const prompt =
        `Зроби код-рев'ю. Мета коду: ${args.goal}\n` +
        `${args.file_context ? `Файл: ${args.file_context}\n` : ""}` +
        `\nКод:\n\`\`\`javascript\n${args.code}\n\`\`\``;
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
  // Перевірка токена
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

  if (req.url?.startsWith("/message")) {
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

httpServer.listen(PORT, () => {
  console.log(`✅ Gemini MCP сервер запущено на порту ${PORT}`);
  if (AUTH_TOKEN) console.log("   Захист токеном: увімкнено");
  if (PROJECT_CONTEXT) console.log("   Контекст проекту: завантажено");
});
