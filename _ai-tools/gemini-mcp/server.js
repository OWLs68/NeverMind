/**
 * Gemini MCP Server — Streamable HTTP транспорт
 * Сумісний з claude.ai connectors (веб, телефон, будь-який пристрій)
 */

import http from "http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 3000;
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const PROJECT_CONTEXT = process.env.PROJECT_CONTEXT || "";

if (!GEMINI_API_KEY) {
  console.error("❌ Потрібна змінна середовища GEMINI_API_KEY");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Системний контекст — додається до кожного запиту вручну
const SYSTEM_PROMPT = `Ти — AI-асистент розробника у проекті NeverMind.
NeverMind — персональний PWA-агент продуктивності.
Стек: ванільний JavaScript, localStorage, GitHub Pages. Без фреймворків, без бекенду.
Мова UI: українська. Відповідай стисло і по суті.
${PROJECT_CONTEXT ? `Контекст проекту: ${PROJECT_CONTEXT}` : ""}`.trim();

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
          "ЗАВЖДИ передавай у context: поточну задачу, релевантний код або файли, обмеження проекту.",
        inputSchema: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description: "Питання або задача для Gemini",
            },
            context: {
              type: "string",
              description: "Поточна задача + релевантний код/файли + обмеження проекту.",
            },
          },
          required: ["question", "context"],
        },
      },
      {
        name: "gemini_review_code",
        description: "Попроси Gemini зробити код-рев'ю. Знайде баги, проблеми з безпекою, неефективні місця.",
        inputSchema: {
          type: "object",
          properties: {
            code: { type: "string", description: "Код для рев'ю" },
            goal: { type: "string", description: "Що цей код має робити" },
            file_context: { type: "string", description: "Назва файлу і його роль (необов'язково)" },
          },
          required: ["code", "goal"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "ask_gemini") {
      const prompt = `${SYSTEM_PROMPT}\n\nКонтекст:\n${args.context}\n\nПитання:\n${args.question}`;
      const result = await model.generateContent(prompt);
      return { content: [{ type: "text", text: `**Gemini:**\n\n${result.response.text()}` }] };
    }

    if (name === "gemini_review_code") {
      const prompt =
        `${SYSTEM_PROMPT}\n\nЗроби код-рев'ю. Мета: ${args.goal}\n` +
        `${args.file_context ? `Файл: ${args.file_context}\n` : ""}` +
        `\nКод:\n\`\`\`javascript\n${args.code}\n\`\`\``;
      const result = await model.generateContent(prompt);
      return { content: [{ type: "text", text: `**Gemini Code Review:**\n\n${result.response.text()}` }] };
    }

    throw new Error(`Невідомий інструмент: ${name}`);
  });

  return server;
}

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-session-id");
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");
}

function checkAuth(req) {
  if (!AUTH_TOKEN) return true;
  const token =
    req.headers["authorization"]?.replace("Bearer ", "") ||
    new URL(req.url, "http://x").searchParams.get("token");
  return token === AUTH_TOKEN;
}

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");

  // CORS preflight
  if (req.method === "OPTIONS") {
    setCORS(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (url.pathname === "/health" || url.pathname === "/") {
    setCORS(res);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", name: "gemini-mcp" }));
    return;
  }

  // MCP endpoint — stateless, кожен запит незалежний
  if (url.pathname === "/mcp") {
    setCORS(res);

    if (!checkAuth(req)) {
      res.writeHead(401, { "Content-Type": "text/plain" });
      res.end("Unauthorized");
      return;
    }

    let body = "";
    for await (const chunk of req) body += chunk;
    const parsed = body ? JSON.parse(body) : undefined;

    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless режим
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, parsed);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

httpServer.listen(PORT, () => {
  console.log(`✅ Gemini MCP сервер (Streamable HTTP) запущено на порту ${PORT}`);
  console.log(`   MCP endpoint: /mcp`);
  if (AUTH_TOKEN) console.log("   Захист токеном: увімкнено");
});
