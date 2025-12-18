// =========================
// : package:  IMPORT DEPENDENCIES
// =========================
// Core libraries
import express from "express";
import fs from "fs";
import jwt from "jsonwebtoken";
import TranscriptionService from "./transcription-service.js";
import path from "path";
import bodyParser from "body-parser";
import cors from "cors";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { randomUUID } from "crypto";
import http from "http";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { Vonage } from "@vonage/server-sdk";
import { WebSocketServer } from "ws";

// Initialize Express with WebSocket capability
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
  },
  allowEIO3: true,
  transports: ["polling", "websocket"], // Support both
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e8, // 100 MB for large audio chunks
  path: "/socket.io/",
});

// ✅ Add middleware to handle ngrok headers
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, ngrok-skip-browser-warning"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

// Environment config
dotenv.config();

// After dotenv. config()
const transcriptionService = new TranscriptionService(
  process.env.AWS_REGION || "us-east-1",
  process.env.AWS_ACCESS_KEY_ID,
  process.env.AWS_SECRET_ACCESS_KEY
);

// Store active transcriptions
const activeTranscriptions = new Map();

// Transcription callback handler
const handleTranscription = (data) => {
  console.log(`📝 Transcription [${data.speaker}]: ${data.transcript}`);

  // Send transcription to browser via Socket.IO
  const browserSocket = browserSockets.get(data.callId);
  if (browserSocket && browserSocket.connected) {
    browserSocket.emit("transcription", {
      speaker: data.speaker,
      transcript: data.transcript,
      isFinal: data.isFinal,
      timestamp: data.timestamp,
    });
  }
};

// =========================
// :compass: PATH & DIRECTORY SETUP
// =========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================
// :jigsaw: EXPRESS MIDDLEWARE
// =========================
app.use(bodyParser.json()); // Parse JSON bodies from incoming requests
app.use(cors()); // Allow cross-origin requests (React frontend, etc.)
app.use(express.json());

// =========================
// :spanner: MANUAL CONFIGURATION
// =========================
// These values should ideally come from a . env file
const VONAGE_APPLICATION_ID = process.env.APP_ID; // Your Vonage App ID
const VONAGE_NUMBER = process.env.VONAGE_NUMBER; // Your virtual Vonage number
const VONAGE_PRIVATE_KEY_PATH = path.join(
  __dirname,
  process.env.PRIVATE_KEY_PATH
); // Private key file location

// Use environment variable or default to production URL
let RAILS_WEBHOOK_URL;
if (process.env.APP_ENVIRONMENT === "production") {
  RAILS_WEBHOOK_URL = process.env.RAILS_PRODUCTION_WEBHOOK_URL;
} else if (process.env.APP_ENVIRONMENT === "development") {
  RAILS_WEBHOOK_URL = process.env.RAILS_DEVELOPMENT_WEBHOOK_URL;
} else {
  RAILS_WEBHOOK_URL = "http://localhost:3000/health_check";
}
const isStreamHealthy = (stream) => {
  return stream && !stream.destroyed && stream.writable;
};
// Comment / Uncomment below logs to verify the values are correct from . env file
console.log("APP_ENVIRONMENT:  ", process.env.APP_ENVIRONMENT);
console.log("VONAGE_PRIVATE_KEY_PATH:", VONAGE_PRIVATE_KEY_PATH);
console.log("RAILS_WEBHOOK_URL:", RAILS_WEBHOOK_URL);
console.log("APP_ID:  ", process.env.APP_ID);
console.log("PRIVATE_KEY_PATH: ", VONAGE_PRIVATE_KEY_PATH);
console.log("VONAGE_NUMBER: ", VONAGE_NUMBER);
console.log("PORT: ", process.env.PORT);

// Load private key for JWT signing
const privateKey = fs.readFileSync(VONAGE_PRIVATE_KEY_PATH, "utf8");
const conversationMetaStore = new Map();

// Initialize Vonage SDK
const vonage = new Vonage({
  applicationId: VONAGE_APPLICATION_ID,
  privateKey: privateKey,
});

export function generateVonageJWT() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    application_id: VONAGE_APPLICATION_ID,
    iat: now,
    jti: Math.random().toString(36).substring(2),
  };
  const token = jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    expiresIn: "15m", // recommended short expiry
  });

  return token;
}

// async function startTranscriptionLeg({
//   callId,
//   from_user_id,
//   to_user_id,
//   session_id,
// }) {
//   const wsUri =
//     `wss://conx-calling.delfiy.com/voice` +
//     `?role=vonage` +
//     `&callId=${callId}` +
//     `&fromUserId=${from_user_id}` +
//     `&toUserId=${to_user_id}` +
//     `&sessionId=${session_id}`;

//   const ncco = [
//     {
//       action: "connect",
//       endpoint: [
//         {
//           type: "websocket",
//           uri: wsUri,
//           "content-type": "audio/l16;rate=16000",
//         },
//       ],
//     },
//   ];

//   const token = generateVonageJWT();

//   console.log("🎧 Creating transcription leg via REST");

//   const response = await fetch("https://api.nexmo.com/v1/calls", {
//     method: "POST",
//     headers: {
//       Authorization: `Bearer ${token}`,
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify({
//       to: [{ type: "websocket", uri: wsUri }],
//       from: { type: "phone", number: VONAGE_NUMBER },
//       ncco,
//     }),
//   });

//   const result = await response.json();

//   if (!response.ok) {
//     console.error("❌ Failed to create transcription leg", result);
//     throw new Error("Transcription leg creation failed");
//   }

//   console.log("✅ Transcription leg created:", result.uuid);
//   console.log("✅ Transcription leg results:", result);

//   return result;
// }

// =========================
// ROUTES
// =========================

app.get("/", (req, res) => {
  res.json({
    status: "running",
    socketIO: "enabled",
    transports: ["polling", "websocket"],
  });
});

// Test Socket.IO endpoint
app.get("/test-socket", (req, res) => {
  res.send(`
    <! DOCTYPE html>
    <html>
    <head>
      <title>Socket.IO Test</title>
      <script src="/socket.io/socket.io.js"></script>
    </head>
    <body>
      <h1>Socket.IO Connection Test</h1>
      <div id="status">Connecting...</div>
      <script>
        const socket = io('/browser', {
          transports: ['polling']
        });
        
        socket.on('connect', () => {
          document.getElementById('status').innerHTML = '✅ Connected!  Socket ID: ' + socket.id;
          console.log('Connected:', socket.id);
        });
        
        socket.on('connect_error', (err) => {
          document.getElementById('status').innerHTML = '❌ Error: ' + err.message;
          console.error('Error:', err);
        });
      </script>
    </body>
    </html>
  `);
});

// Store connections
const browserSockets = new Map();
const vonageConnections = new Map();

// Browser namespace
const browserIO = io.of("/browser");

browserIO.on("connection", (socket) => {
  console.log("✅ Browser connected:", socket.id);
  console.log("📡 Transport:", socket.conn.transport.name);

  let callId = null;

  socket.conn.on("upgrade", (transport) => {
    console.log("🔄 Transport upgraded to:", transport.name);
  });

  socket.on("register", async (data) => {
    callId = data.callId;
    console.log(`📞 Browser registered for call ${callId}`);
    browserSockets.set(callId, socket);

    socket.emit("registered", {
      callId,
      status: "connected",
      socketId: socket.id,
      transport: socket.conn.transport.name,
    });
    // ✅ Start transcription for browser user
    // try {
    //   const browserTranscription =
    //     await transcriptionService.startTranscription(
    //       callId,
    //       "browser",
    //       handleTranscription
    //     );

    //   // Store transcription reference
    //   if (!activeTranscriptions.has(callId)) {
    //     activeTranscriptions.set(callId, {});
    //   }
    //   activeTranscriptions.get(callId).browser = browserTranscription;

    //   console.log(`✅ Browser transcription started for call ${callId}`);
    // } catch (error) {
    //   console.error("❌ Failed to start browser transcription:", error);
    // }
  });

  // ✅ NEW:  Receive microphone data from browser
  socket.on("microphone:data", (data) => {
    const micCallId = data.callId;

    // Get Vonage WebSocket connection
    const vonageWs = vonageConnections.get(micCallId);

    if (vonageWs && vonageWs.readyState === 1) {
      // WebSocket. OPEN = 1
      // Convert base64 back to binary
      const binaryString = atob(data.audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Send binary audio to Vonage
      vonageWs.send(bytes.buffer);

      // Log occasionally
      if (Math.random() < 0.01) {
        console.log(
          `🎤 Microphone audio sent to Vonage: ${bytes.length} bytes`
        );
      }
      // ✅ Send to browser transcription stream (with null check)
      const transcriptions = activeTranscriptions.get(micCallId);
      if (transcriptions?.browser?.stream) {
        try {
          const binaryString = atob(data.audio);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          // Write to transcription stream
          transcriptions.browser.stream.write(Buffer.from(bytes.buffer));
        } catch (err) {
          console.error("❌ Error writing to browser transcription:", err);
        }
      }
    } else {
      if (Math.random() < 0.01) {
        console.warn(`⚠️ No Vonage WebSocket for call ${micCallId}`);
      }
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`❌ Browser disconnected: ${socket.id}, reason: ${reason}`);
    if (callId) {
      browserSockets.delete(callId);
      // ✅ Close browser transcription
      const transcriptions = activeTranscriptions.get(callId);
      if (transcriptions?.browser) {
        try {
          transcriptions.browser.close();
        } catch (err) {
          console.error("Error closing browser transcription:", err);
        }
        delete transcriptions.browser;
      }

      // Clean up if both transcriptions are closed
      if (transcriptions && !transcriptions.phone && !transcriptions.browser) {
        activeTranscriptions.delete(callId);
      }
    }
  });

  socket.on("error", (error) => {
    console.error("❌ Socket error:", error);
  });
});

// WebSocket handler for Vonage (native WebSocket)
// WebSocket handler for Vonage (native WebSocket)
const wss = new WebSocketServer({
  server,
  path: "/socket/vonage",
});

console.log("🔌 WebSocket server created on path:  /socket/vonage");

wss.on("connection", (ws, req) => {
  console.log("\n📡 ========== VONAGE WEBSOCKET CONNECTED ==========");
  console.log("✅ Vonage WebSocket connected!");
  console.log("📊 Request URL:", req.url);
  console.log("📊 Request headers:", JSON.stringify(req.headers, null, 2));

  // Parse URL to get callId from query params
  const urlParts = req.url.split("?");
  const params = new URLSearchParams(urlParts[1] || "");
  let callId = params.get("callId");
  const sessionId = params.get("sessionId");
  const fromUserId = params.get("fromUserId");
  const toUserId = params.get("toUserId");

  console.log("📞 WebSocket params:", {
    callId,
    sessionId,
    fromUserId,
    toUserId,
  });
  console.log("==================================================\n");

  // Send initial acknowledgment to Vonage
  ws.send(
    JSON.stringify({
      event: "connection_acknowledged",
      callId: callId,
    })
  );
  // ✅ Start transcription for phone user
  // ✅ Initialize transcriptions map for this call
  if (!activeTranscriptions.has(callId)) {
    activeTranscriptions.set(callId, {});
  }

  // ✅ Start transcription for phone user
  try {
    const phoneTranscription = transcriptionService.startTranscription(
      callId,
      "phone",
      handleTranscription
    );

    activeTranscriptions.get(callId).phone = phoneTranscription;
    console.log(`✅ Phone transcription started for call ${callId}`);
  } catch (error) {
    console.error("❌ Failed to start phone transcription:", error);
  }

  ws.on("message", (message) => {
    try {
      // Try to parse as JSON (control messages)
      const data = JSON.parse(message.toString());

      console.log("📨 Vonage JSON message event:", data.event);

      if (data.event === "websocket:connected") {
        // Extract callId from headers if not in URL
        if (!callId) {
          callId = data.callId || data.headers?.callId;
        }
        console.log(`✅ Vonage websocket connected confirmed:  ${callId}`);
        vonageConnections.set(callId, ws);

        // Check if browser is already connected
        const browserSocket = browserSockets.get(callId);
        if (browserSocket) {
          console.log(`✅ Browser socket FOUND for call ${callId}`);
        } else {
          console.log(`⚠️ Browser socket NOT FOUND YET for call ${callId}`);
          console.log(
            `📋 Available browser sockets: `,
            Array.from(browserSockets.keys())
          );
        }

        // Send acknowledgment back to Vonage
        ws.send(JSON.stringify({ event: "websocket:connected: ack" }));
      }

      if (data.event === "audio:start") {
        console.log(`🎤 Audio stream started for call ${callId}`);
        console.log(`   Audio format: `, data);
      }

      if (data.event === "audio:stop") {
        console.log(`🎤 Audio stream stopped for call ${callId}`);
      }

      if (data.event === "websocket:error") {
        console.error(`❌ Vonage WebSocket error for call ${callId}:`, data);
      }
    } catch (err) {
      // Binary audio data (raw PCM from phone)
      if (callId && message.length > 0) {
        const browserSocket = browserSockets.get(callId);

        if (browserSocket && browserSocket.connected) {
          // Convert buffer to base64
          const audioBase64 = message.toString("base64");

          // Send to browser via Socket.IO
          browserSocket.emit("audio:data", {
            audio: audioBase64,
            binary: true,
            size: message.length,
          });

          // Log occasionally (1% of packets) to avoid spam
          if (Math.random() < 0.01) {
            console.log(
              `🔊 Audio forwarded to browser for call ${callId} (${message.length} bytes)`
            );
          }
          // ✅ Send to phone transcription stream (with proper null checks)
          const transcriptions = activeTranscriptions.get(callId);
          if (
            transcriptions?.phone?.stream &&
            isStreamHealthy(transcriptions.phone.stream)
          ) {
            try {
              // Check if stream is writable
              if (
                !transcriptions.phone.stream.destroyed &&
                transcriptions.phone.stream.writable
              ) {
                transcriptions.phone.stream.write(message);
              } else {
                console.warn(
                  `⚠️ Phone transcription stream not writable for call ${callId}`
                );
              }
            } catch (err) {
              console.error(
                `❌ Error writing to phone transcription for call ${callId}:`,
                err.message
              );
            }
          } else {
            // Only log occasionally to avoid spam
            if (Math.random() < 0.01) {
              console.warn(
                `⚠️ Phone transcription not ready for call ${callId}`
              );
            }
          }
        } else {
          // Only log occasionally to avoid spam
          if (Math.random() < 0.001) {
            console.log(`⚠️ No browser socket found for call ${callId}`);
            console.log(
              `📋 Available browser sockets:`,
              Array.from(browserSockets.keys())
            );
          }
        }
      }
    }
  });

  ws.on("close", (code, reason) => {
    console.log("\n📡 ========== VONAGE WEBSOCKET CLOSED ==========");
    console.log(`❌ Vonage WebSocket disconnected for call ${callId}`);
    console.log(`   Close code: ${code}`);
    console.log(`   Close reason: ${reason || "No reason provided"}`);
    console.log("=============================================\n");

    if (callId) {
      vonageConnections.delete(callId);

      // Notify browser that call ended
      const browserSocket = browserSockets.get(callId);
      if (browserSocket && browserSocket.connected) {
        browserSocket.emit("call:ended", {
          callId: callId,
          reason: "Vonage disconnected",
        });
      }

      // ✅ Close phone transcription
      const transcriptions = activeTranscriptions.get(callId);
      if (transcriptions?.phone) {
        try {
          transcriptions.phone.close();
        } catch (err) {
          console.error("Error closing phone transcription:", err);
        }
        delete transcriptions.phone;
      }

      // Clean up if both transcriptions are closed
      if (transcriptions && !transcriptions.phone && !transcriptions.browser) {
        activeTranscriptions.delete(callId);
        console.log(`🧹 Cleaned up all transcriptions for call ${callId}`);
      }
    }
  });

  ws.on("error", (error) => {
    console.error("\n❌ ========== VONAGE WEBSOCKET ERROR ==========");
    console.error(`Error for call ${callId}:`, error.message);
    console.error("Stack:", error.stack);
    console.error("=============================================\n");
  });

  // Handle ping/pong for connection health
  ws.on("ping", () => {
    ws.pong();
  });

  ws.on("pong", () => {
    // Connection is alive
  });
});

// Optional: Add periodic cleanup of stale connections
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === 3) {
      // CLOSED
      console.log("🧹 Cleaning up closed WebSocket connection");
    }
  });
}, 30000); // Check every 30 seconds

// =========================
// : silhouette: CREATE VONAGE USER
// =========================
/**
 * Vonage requires users for in-app or client SDK calls.
 * This function creates a user on the Vonage application.
 *
 * @param {string} username - The name of the user to create.
 */
async function createUser(username) {
  try {
    const userResponse = await vonage.users.createUser({
      name: username,
      displayName: username,
    });
    console.log(": white_tick: User created:", userResponse);
    console.log("RAW USER RESPONSE:", JSON.stringify(userResponse, null, 2));
    return userResponse;
  } catch (e) {
    console.error(":x: Error creating user:", e);
  }
}

app.post("/api/user", async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }
  try {
    const userResponse = await createUser(username);
    res.json({ message: "User created successfully", user: userResponse });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ error: "User creation failed" });
  }
});

// =========================
// : globe_with_meridians: GET:  /api/user
// =========================
/**
 * Test endpoint to create a Vonage user (for demonstration).
 * In real-world use, you would trigger this only once per unique user.
 */
app.get("/api/user", async (req, res) => {
  try {
    await createUser("voip_user_1");
    res.json({ message: "User 'voip_user_1' created successfully" });
  } catch (err) {
    console.error("Error generating user:", err);
    res.status(500).json({ error: "User generation failed" });
  }
});

// =========================
// :key: GET: /api/token
// =========================
app.get("/api/token", (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      application_id: VONAGE_APPLICATION_ID,
      iat: now,
      nbf: now,
      exp: now + 60 * 60,
      jti: Math.random().toString(36).substring(2),
      sub: "voip_user_1", // <-- Use Vonage user ID here
      acl: {
        paths: {
          "/*/users/**": {},
          "/*/conversations/**": {},
          "/*/sessions/**": {},
          "/*/devices/**": {},
          "/*/image/**": {},
          "/*/media/**": {},
          "/*/push/**": {},
          "/*/knocking/**": {},
          "/*/legs/**": {},
        },
      },
    };
    const token = jwt.sign(payload, privateKey, { algorithm: "RS256" });
    res.json({ token });
  } catch (err) {
    console.error("Error generating JWT:", err);
    res.status(500).json({ error: "Token generation failed" });
  }
});

// =========================
// :phone:  GET: /answer
// =========================
app.get("/answer", async (req, res) => {
  console.log("\n🎉 ========== ANSWER WEBHOOK CALLED ==========");
  console.log("📞 Vonage is calling our /answer endpoint!");

  const { to_user_id, from_user_id, uuid, session_id, callId } = req.query;

  console.log("📊 Query params:", {
    callId,
    from_user_id,
    to_user_id,
    session_id,
    uuid,
  });

  // ✅ Get your current ngrok URL from environment or hardcode it
  const NGROK_URL =
    process.env.NGROK_URL || "https://78864b6eaf2f.ngrok-free.app";

  // ✅ Construct WebSocket URL properly - NO SPACES!
  const wsUrl = `wss://78864b6eaf2f.ngrok-free.app/socket/vonage?callId=${callId}&sessionId=${session_id}&fromUserId=${from_user_id}&toUserId=${to_user_id}`;

  console.log("🔗 WebSocket URL:", wsUrl);

  const ncco = [
    {
      action: "talk",
      text: "Connecting your call",
      bargeIn: false,
    },
    {
      action: "connect",
      timeout: 60,
      from: VONAGE_NUMBER,
      endpoint: [
        {
          type: "websocket",
          uri: wsUrl,
          "content-type": "audio/l16;rate=16000",
          headers: {
            callId: callId,
            sessionId: session_id,
            fromUserId: from_user_id,
            toUserId: to_user_id,
          },
        },
      ],
    },
  ];

  console.log("📤 Returning NCCO:", JSON.stringify(ncco, null, 2));
  console.log("⏰ Waiting for Vonage WebSocket connection...\n");

  res.json(ncco);
});

// =========================
// :satellite_antenna: POST: /event
// =========================
app.post("/event", async (req, res) => {
  console.log("\n📡 ========== EVENT WEBHOOK CALLED ==========");
  console.log("📊 Event data:", JSON.stringify(req.body, null, 2));
  console.log("📊 Event status:", req.body.status);
  console.log("📊 Event type:", req.body.type);
  console.log("===============================================\n");

  res.sendStatus(200);
});

// =========================
// POST: /recording
// =========================
app.post("/recording", async (req, res) => {
  console.log("🎙️ Recording event received:", req.body);
  res.sendStatus(200);
});

// =========================
// : phone: POST: /api/hangup
// =========================
app.post("/api/hangup", async (req, res) => {
  try {
    const { call_uuid } = req.body;

    if (!call_uuid) {
      return res.status(400).json({ error: "call_uuid is required" });
    }

    const token = generateVonageJWT();

    const response = await fetch(
      `https://api.nexmo.com/v1/calls/${call_uuid}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "hangup" }),
      }
    );

    let result = null;
    const text = await response.text();
    if (text) {
      try {
        result = JSON.parse(text);
      } catch {
        result = text;
      }
    }

    console.log("Hangup Response:", result, response.status);

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Failed to hang up call",
        details: result,
      });
    }

    return res.json({
      message: "Call successfully hung up",
      result,
    });
  } catch (error) {
    console.error("Hangup Error:", error);
    return res
      .status(500)
      .json({ error: "Server error while hanging up call" });
  }
});

// =========================
// :phone: POST: /api/call
// =========================
// https
app.post("/api/call", async (req, res) => {
  const { to, from_user_id, to_user_id, session_id } = req.body;
  console.log("📞 Call params:", req.body);
  const callId = randomUUID();

  const NGROK_URL = "https://78864b6eaf2f.ngrok-free.app";

  try {
    const result = await vonage.voice.createOutboundCall({
      to: [
        {
          type: "phone",
          number: to,
        },
      ],
      from: {
        type: "phone",
        number: VONAGE_NUMBER,
      },
      answerUrl: [
        `${NGROK_URL}/answer?callId=${callId}&from_user_id=${encodeURIComponent(
          from_user_id
        )}&to_user_id=${encodeURIComponent(
          to_user_id
        )}&session_id=${encodeURIComponent(session_id)}`,
      ],
      eventUrl: [`${NGROK_URL}/event`],
    });

    console.log("✅ Call created successfully!");
    console.log("📞 Call UUID:", result.uuid);
    console.log("📞 Call Status:", result.status);
    console.log("📞 Call Direction:", result.direction);
    console.log(
      "🔗 Answer URL will be:",
      `${NGROK_URL}/answer?callId=${callId}`
    );
    console.log("⏰ Now waiting for phone to be answered...");

    res.json({ ...result, callId });
  } catch (err) {
    console.error("❌ Error creating call:", err);
    console.error("❌ Error details:", err.response?.data || err.message);
    res
      .status(500)
      .json({ error: "Failed to place call", details: err.message });
  }
});

// =========================
// :rocket: START EXPRESS SERVER
// =========================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
  console.log("📡 Socket.IO available at https://78864b6eaf2f.ngrok-free.app");
  console.log("🧪 Test page:  https://78864b6eaf2f.ngrok-free.app/test-socket");
});
