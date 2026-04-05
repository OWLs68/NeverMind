/**
 * Gemini MCP Server — dual transport (SSE + Streamable HTTP)
 * Сумісний з claude.ai/code (веб, телефон, будь-який пристрій)
 *
 * Endpoints:
 *   GET  /sse              — SSE transport (protocol 2024-11-05)
 *   POST /messages          — SSE message handler
 *   POST/GET/DELETE /mcp   — Streamable HTTP transport (protocol 2025-11-25)
 *   GET  /health            — Health check
 */

import http from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenAI } from "@google/genai";

// --- Config ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 3000;
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const PROJECT_CONTEXT = process.env.PROJECT_CONTEXT || "";

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is required");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const SYSTEM_PROMPT = `Ти — AI-асистент розробника у проекті NeverMind.
NeverMind — персональний PWA-агент продуктивності.
Стек: ванільний JavaScript, localStorage, GitHub Pages. Без фреймворків, без бекенду.
Мова UI: українська. Відповідай стисло і по суті.
${PROJECT_CONTEXT ? `Контекст проекту: ${PROJECT_CONTEXT}` : ""}`.trim();

// --- MCP Server builder ---
function buildServer() {
  const server = new Server(
    { name: "gemini-mcp", version: "2.0.0" },
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
              description:
                "Поточна задача + релевантний код/файли + обмеження проекту.",
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
            code: { type: "string", description: "Код для рев'ю" },
            goal: { type: "string", description: "Що цей код має робити" },
            file_context: {
              type: "string",
              description: "Назва файлу і його роль (необов'язково)",
            },
          },
          required: ["code", "goal"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === "ask_gemini") {
        const prompt = `${SYSTEM_PROMPT}\n\nКонтекст:\n${args.context}\n\nПитання:\n${args.question}`;
        const result = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: prompt,
        });
        return {
          content: [{ type: "text", text: `**Gemini:**\n\n${result.text}` }],
        };
      }

      if (name === "gemini_review_code") {
        const prompt =
          `${SYSTEM_PROMPT}\n\nЗроби код-рев'ю. Мета: ${args.goal}\n` +
          `${args.file_context ? `Файл: ${args.file_context}\n` : ""}` +
          `\nКод:\n\`\`\`javascript\n${args.code}\n\`\`\``;
        const result = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: prompt,
        });
        return {
          content: [
            { type: "text", text: `**Gemini Code Review:**\n\n${result.text}` },
          ],
        };
      }
    } catch (err) {
      console.error(`[tool:${name}] Gemini API error:`, err.message);
      return {
        content: [
          { type: "text", text: `Gemini API помилка: ${err.message}` },
        ],
        isError: true,
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

// --- Helpers ---
function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, mcp-session-id"
  );
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");
}

function checkAuth(req) {
  if (!AUTH_TOKEN) return true;
  const token =
    req.headers["authorization"]?.replace("Bearer ", "") ||
    new URL(req.url, "http://x").searchParams.get("token");
  return token === AUTH_TOKEN;
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// --- Session storage ---
const transports = {};

// --- HTTP Server ---
const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const method = req.method;

  // CORS preflight
  if (method === "OPTIONS") {
    setCORS(res);
    res.writeHead(204);
    res.end();
    return;
  }

  setCORS(res);

  // Health check
  if (url.pathname === "/health" || url.pathname === "/") {
    const sessions = Object.keys(transports).length;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        name: "gemini-mcp",
        version: "2.0.0",
        transports: ["sse", "streamable-http"],
        activeSessions: sessions,
      })
    );
    return;
  }

  // Auth check for MCP endpoints
  if (["/sse", "/messages", "/mcp"].includes(url.pathname)) {
    if (!checkAuth(req)) {
      log(`AUTH FAILED: ${method} ${url.pathname}`);
      res.writeHead(401, { "Content-Type": "text/plain" });
      res.end("Unauthorized");
      return;
    }
  }

  // =========================================================
  // SSE TRANSPORT (protocol 2024-11-05) — deprecated but widely used
  // =========================================================

  // GET /sse — establish SSE stream
  if (url.pathname === "/sse" && method === "GET") {
    log("SSE: new connection");
    const transport = new SSEServerTransport("/messages", res);
    transports[transport.sessionId] = transport;
    log(`SSE: session ${transport.sessionId} created`);

    res.on("close", () => {
      log(`SSE: session ${transport.sessionId} closed`);
      delete transports[transport.sessionId];
    });

    const server = buildServer();
    await server.connect(transport);
    await transport.start();
    return;
  }

  // POST /messages?sessionId=xxx — handle SSE messages
  if (url.pathname === "/messages" && method === "POST") {
    const sessionId = url.searchParams.get("sessionId");
    log(`SSE: message for session ${sessionId}`);

    const transport = transports[sessionId];
    if (!transport || !(transport instanceof SSEServerTransport)) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Invalid or expired session");
      return;
    }

    const body = await readBody(req);
    const parsed = body ? JSON.parse(body) : undefined;
    await transport.handlePostMessage(req, res, parsed);
    return;
  }

  // =========================================================
  // STREAMABLE HTTP TRANSPORT (protocol 2025-11-25) — new standard
  // =========================================================

  if (url.pathname === "/mcp") {
    log(`Streamable HTTP: ${method} /mcp`);
    const body = await readBody(req);
    const parsed = body ? JSON.parse(body) : undefined;

    try {
      const sessionId = req.headers["mcp-session-id"];

      if (sessionId && transports[sessionId]) {
        const transport = transports[sessionId];
        if (transport instanceof StreamableHTTPServerTransport) {
          await transport.handleRequest(req, res, parsed);
          return;
        }
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Session uses a different transport",
            },
            id: null,
          })
        );
        return;
      }

      // New session — only on POST
      if (method === "POST" && !sessionId) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            log(`Streamable HTTP: session ${sid} created`);
            transports[sid] = transport;
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            log(`Streamable HTTP: session ${sid} closed`);
            delete transports[sid];
          }
        };

        const server = buildServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, parsed);
        return;
      }

      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad request" },
          id: null,
        })
      );
    } catch (err) {
      log(`Streamable HTTP error: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal error" },
            id: null,
          })
        );
      }
    }
    return;
  }

  // 404
  res.writeHead(404);
  res.end("Not found");
});

// --- Start ---
httpServer.listen(PORT, () => {
  log(`Gemini MCP server started on port ${PORT}`);
  log(`  SSE transport:        GET /sse + POST /messages`);
  log(`  Streamable HTTP:      /mcp`);
  log(`  Health:               /health`);
  log(`  Auth: ${AUTH_TOKEN ? "enabled" : "disabled"}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  log("Shutting down...");
  for (const sid of Object.keys(transports)) {
    try {
      await transports[sid].close();
    } catch (_) {}
    delete transports[sid];
  }
  process.exit(0);
});
