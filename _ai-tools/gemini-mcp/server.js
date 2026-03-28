/**
 * Gemini MCP Server
 * Дає Claude Code доступ до Gemini як до інструменту.
 *
 * Як працює:
 *   Claude отримує питання → за потреби викликає ask_gemini() →
 *   Gemini відповідає → Claude порівнює обидві думки → дає тобі фінал
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ Потрібна змінна середовища GEMINI_API_KEY");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- MCP Server ---

const server = new Server(
  { name: "gemini-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Список інструментів які бачить Claude
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

// Обробка викликів інструментів
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "ask_gemini") {
    const prompt = args.context
      ? `Контекст:\n${args.context}\n\nПитання:\n${args.question}`
      : args.question;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return {
      content: [
        {
          type: "text",
          text: `**Gemini відповідає:**\n\n${text}`,
        },
      ],
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
      content: [
        {
          type: "text",
          text: `**Gemini Code Review:**\n\n${text}`,
        },
      ],
    };
  }

  throw new Error(`Невідомий інструмент: ${name}`);
});

// Запуск
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("✅ Gemini MCP сервер запущено");
