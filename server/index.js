// =========================
// :  package:   IMPORT DEPENDENCIES
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

console.log("🔧 Initializing Socket.IO server...");
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
console.log("✅ Socket.IO server initialized successfully");

// ✅ Add middleware to handle ngrok headers
app.use((req, res, next) => {
  console.log(`📥 Incoming ${req.method} request to ${req.path}`);
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, ngrok-skip-browser-warning"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

// Environment config
console.log("🔧 Loading environment variables...");
dotenv.config();
console.log("✅ Environment variables loaded");

// After dotenv. config()
console.log("🔧 Initializing AWS Transcription Service...");
const transcriptionService = new TranscriptionService(
  process.env.AWS_REGION || "us-east-1",
  process.env.AWS_ACCESS_KEY_ID,
  process.env.AWS_SECRET_ACCESS_KEY
);
console.log(
  `✅ Transcription Service initialized for region: ${
    process.env.AWS_REGION || "us-east-1"
  }`
);

// Store active transcriptions
const activeTranscriptions = new Map();
console.log("📋 Active transcriptions map initialized");

const audioBuffers = new Map();
console.log("📋 Audio buffers map initialized");
// Transcription callback handler
const handleTranscription = (data) => {
  console.log(`\n📝 ========== TRANSCRIPTION RECEIVED ==========`);
  console.log(`📞 Call ID: ${data.callId}`);
  console.log(`👤 Speaker: ${data.speaker}`);
  console.log(`💬 Transcript: ${data.transcript}`);
  console.log(`✔️  Is Final: ${data.isFinal}`);
  console.log(`⏰ Timestamp: ${data.timestamp}`);

  // ✅ Debug browser socket lookup
  console.log(`🔍 Looking up browser socket for callId: ${data.callId}`);
  console.log(
    `📋 All available browser sockets:`,
    Array.from(browserSockets.keys())
  );

  // Send transcription to browser via Socket.IO
  const browserSocket = browserSockets.get(data.callId);
  console.log(`🔍 Browser socket lookup result:`);
  console.log(`   - Socket found: ${!!browserSocket}`);
  console.log(`   - Socket connected: ${browserSocket?.connected}`);
  console.log(`   - Socket ID: ${browserSocket?.id}`);
  if (browserSocket && browserSocket.connected) {
    browserSocket.emit("transcription", {
      speaker: data.speaker,
      transcript: data.transcript,
      isFinal: data.isFinal,
      timestamp: data.timestamp,
    });
    console.log(`✅ Transcription sent to browser for call ${data.callId}`);
  } else {
    console.warn(
      `⚠️  No connected browser socket found for call ${data.callId}`
    );
  }
  console.log(`==============================================\n`);
};

// =========================
// : compass: PATH & DIRECTORY SETUP
// =========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log(`📂 Current directory: ${__dirname}`);
console.log(`📄 Current file: ${__filename}`);

// =========================
// :jigsaw: EXPRESS MIDDLEWARE
// =========================
console.log("🔧 Configuring Express middleware...");
app.use(bodyParser.json()); // Parse JSON bodies from incoming requests
app.use(cors()); // Allow cross-origin requests (React frontend, etc.)
app.use(express.json());
console.log("✅ Express middleware configured");

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
console.log("\n🔧 ========== CONFIGURATION ==========");
console.log("APP_ENVIRONMENT:   ", process.env.APP_ENVIRONMENT);
console.log("VONAGE_PRIVATE_KEY_PATH:", VONAGE_PRIVATE_KEY_PATH);
console.log("RAILS_WEBHOOK_URL:", RAILS_WEBHOOK_URL);
console.log("APP_ID:   ", process.env.APP_ID);
console.log("PRIVATE_KEY_PATH:  ", VONAGE_PRIVATE_KEY_PATH);
console.log("VONAGE_NUMBER: ", VONAGE_NUMBER);
console.log("PORT: ", process.env.PORT);
console.log("AWS_REGION: ", process.env.AWS_REGION || "us-east-1");
console.log("=====================================\n");

// Load private key for JWT signing
console.log("🔐 Loading Vonage private key...");
const privateKey = fs.readFileSync(VONAGE_PRIVATE_KEY_PATH, "utf8");
console.log("✅ Private key loaded successfully");

const conversationMetaStore = new Map();
console.log("📋 Conversation metadata store initialized");

// Initialize Vonage SDK
console.log("🔧 Initializing Vonage SDK...");
const vonage = new Vonage({
  applicationId: VONAGE_APPLICATION_ID,
  privateKey: privateKey,
});
console.log("✅ Vonage SDK initialized");

export function generateVonageJWT() {
  console.log("🔐 Generating Vonage JWT token...");
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
  console.log("✅ Vonage JWT token generated successfully (expires in 15m)");
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
//       from: { type:  "phone", number: VONAGE_NUMBER },
//       ncco,
//     }),
//   });

//   const result = await response.json();

//   if (! response.ok) {
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
  console.log("🏠 Root endpoint accessed");
  const response = {
    status: "running",
    socketIO: "enabled",
    transports: ["polling", "websocket"],
  };
  console.log("📤 Sending response:", response);
  res.json(response);
});

// Test Socket.IO endpoint
app.get("/test-socket", (req, res) => {
  console.log("🧪 Socket.IO test page accessed");
  res.send(`
    <!  DOCTYPE html>
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
          document.getElementById('status').innerHTML = '✅ Connected!   Socket ID: ' + socket.id;
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
console.log("📋 Browser sockets and Vonage connections maps initialized");

// Browser namespace
const browserIO = io.of("/browser");
console.log("🌐 Browser namespace created:   /browser");

browserIO.on("connection", (socket) => {
  console.log("\n🌐 ========== BROWSER SOCKET CONNECTED ==========");
  console.log("✅ Browser connected");
  console.log("🆔 Socket ID:", socket.id);
  console.log("📡 Transport:", socket.conn.transport.name);
  console.log("🔌 Connection details:", {
    remoteAddress: socket.handshake.address,
    headers: socket.handshake.headers["user-agent"],
  });

  let callId = null;

  socket.conn.on("upgrade", (transport) => {
    console.log("\n🔄 ========== TRANSPORT UPGRADE ==========");
    console.log(`🆔 Socket ID: ${socket.id}`);
    console.log(`🔄 Transport upgraded to: ${transport.name}`);
    console.log("=========================================\n");
  });

  socket.on("register", async (data) => {
    callId = data.callId;
    console.log("\n📝 ========== BROWSER REGISTRATION ==========");
    console.log(`📞 Call ID: ${callId}`);
    console.log(`🆔 Socket ID: ${socket.id}`);
    console.log(`📊 Registration data: `, data);

    browserSockets.set(callId, socket);
    console.log(`✅ Browser socket registered for call ${callId}`);
    console.log(`📊 Total browser sockets:  ${browserSockets.size}`);
    console.log(
      `📋 All browser socket callIds: `,
      Array.from(browserSockets.keys())
    );
    // ✅ CHECK VONAGE CONNECTION STATUS
    const vonageWs = vonageConnections.get(callId);
    console.log(`🔍 Checking Vonage connection for this callId:`);
    console.log(`   - Vonage WS exists: ${!!vonageWs}`);
    console.log(`   - Vonage WS state: ${vonageWs?.readyState}`);
    console.log(
      `   - All Vonage connections: `,
      Array.from(vonageConnections.keys())
    );
    socket.emit("registered", {
      callId,
      status: "connected",
      socketId: socket.id,
      transport: socket.conn.transport.name,
    });
    console.log(`📤 Registration confirmation sent to browser`);

    // ✅ Initialize transcriptions map for this call if not exists
    if (!activeTranscriptions.has(callId)) {
      activeTranscriptions.set(callId, {});
      console.log(`📋 Initialized transcriptions map for call ${callId}`);
    }

    // ✅ Initialize audio buffer for browser if not exists
    if (!audioBuffers.has(callId)) {
      audioBuffers.set(callId, { phone: [], browser: [] });
      console.log(`📋 Initialized audio buffers for call ${callId}`);
    }

    // ✅ Start transcription for browser user
    try {
      console.log(`🎙️ Starting browser transcription for call ${callId}...`);

      const browserTranscription =
        await transcriptionService.startTranscription(
          callId,
          "browser",
          handleTranscription
        );

      console.log(`✅ Browser transcription object created for call ${callId}`);
      console.log(`🔍 Browser transcription state: `, {
        hasStream: !!browserTranscription?.stream,
        streamDestroyed: browserTranscription?.stream?.destroyed,
        streamWritable: browserTranscription?.stream?.writable,
      });

      activeTranscriptions.get(callId).browser = browserTranscription;

      // Wait a bit for stream to be fully ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log(
        `✅ Browser transcription fully initialized for call ${callId}`
      );

      // Process any buffered browser audio chunks
      const buffers = audioBuffers.get(callId);
      if (buffers?.browser && buffers.browser.length > 0) {
        console.log(
          `📦 Processing ${buffers.browser.length} buffered browser audio chunks`
        );

        for (const chunk of buffers.browser) {
          if (isStreamHealthy(browserTranscription.stream)) {
            browserTranscription.stream.write(chunk);
          }
        }

        console.log(`✅ Buffered browser chunks processed`);
        buffers.browser = []; // Clear buffer
      }
    } catch (error) {
      console.error(
        `❌ Failed to start browser transcription for call ${callId}:`,
        error.message
      );
      console.error(`   Error stack: `, error.stack);
    }

    console.log("===========================================\n");
  });

  // ✅ Receive microphone data from browser
  // ✅ Receive microphone data from browser
  // ✅ Receive microphone data from browser
  socket.on("microphone:data", (data) => {
    const micCallId = data.callId;

    console.log(`\n🎤 ========== MICROPHONE DATA RECEIVED ==========`);
    console.log(`📞 Call ID: ${micCallId}`);
    console.log(`📊 Audio data length (base64): ${data.audio?.length || 0}`);
    console.log(`📊 Data keys: `, Object.keys(data));

    // Get Vonage WebSocket connection
    const vonageWs = vonageConnections.get(micCallId);

    console.log(`🔍 Vonage WebSocket state:`);
    console.log(`   - Found: ${!!vonageWs}`);
    console.log(`   - Ready state: ${vonageWs?.readyState}`);
    console.log(
      `   - Available connections: `,
      Array.from(vonageConnections.keys())
    );

    if (vonageWs && vonageWs.readyState === 1) {
      // WebSocket. OPEN = 1

      try {
        // ✅ Convert base64 to binary using Buffer (Node.js way)
        const audioBuffer = Buffer.from(data.audio, "base64");
        console.log(`✅ Audio buffer created: ${audioBuffer.length} bytes`);

        // Send binary audio to Vonage
        vonageWs.send(audioBuffer);
        console.log(`✅ Audio sent to Vonage WebSocket`);

        // ✅ Send to browser transcription stream
        const transcriptions = activeTranscriptions.get(micCallId);

        if (
          transcriptions?.browser?.stream &&
          isStreamHealthy(transcriptions.browser.stream)
        ) {
          transcriptions.browser.stream.write(audioBuffer);
          console.log(`✅ Audio written to browser transcription stream`);
        } else {
          // Buffer the audio chunk
          const buffers = audioBuffers.get(micCallId);
          if (buffers) {
            if (!buffers.browser) buffers.browser = [];
            buffers.browser.push(audioBuffer);
            console.warn(
              `⚠️ Buffering browser audio (buffer size:  ${buffers.browser.length} chunks)`
            );
            console.log(`🔍 Browser transcription state:`, {
              hasTranscription: !!transcriptions?.browser,
              hasStream: !!transcriptions?.browser?.stream,
              streamDestroyed: transcriptions?.browser?.stream?.destroyed,
              streamWritable: transcriptions?.browser?.stream?.writable,
            });
          }
        }
      } catch (err) {
        console.error(`❌ Error processing microphone data: `, err.message);
        console.error(`   Stack:`, err.stack);
      }
    } else {
      console.error(`❌ Vonage WebSocket not ready! `);
      console.error(`   - WebSocket exists: ${!!vonageWs}`);
      console.error(
        `   - Ready state: ${vonageWs?.readyState} (should be 1 for OPEN)`
      );
      console.error(`   - Call ID match: ${micCallId}`);
    }
    console.log(`===============================================\n`);
  });

  socket.on("disconnect", (reason) => {
    console.log("\n❌ ========== BROWSER SOCKET DISCONNECTED ==========");
    console.log(`🆔 Socket ID: ${socket.id}`);
    console.log(`📞 Call ID: ${callId || "not registered"}`);
    console.log(`❓ Reason: ${reason}`);

    if (callId) {
      browserSockets.delete(callId);
      console.log(`🗑️ Browser socket removed for call ${callId}`);
      console.log(`📊 Remaining browser sockets: ${browserSockets.size}`);

      // ✅ Close browser transcription
      const transcriptions = activeTranscriptions.get(callId);
      if (transcriptions?.browser) {
        try {
          transcriptions.browser.close();
          console.log(`✅ Browser transcription closed for call ${callId}`);
        } catch (err) {
          console.error(
            `❌ Error closing browser transcription for call ${callId}:`,
            err.message
          );
        }
        delete transcriptions.browser;
      }

      // Clean up if both transcriptions are closed
      if (transcriptions && !transcriptions.phone && !transcriptions.browser) {
        activeTranscriptions.delete(callId);
        console.log(`🧹 All transcriptions cleaned up for call ${callId}`);
      }

      // Clean up audio buffer
      audioBuffers.delete(callId);
      console.log(`🗑️ Audio buffer cleared for call ${callId}`);
    }
    console.log("===================================================\n");
  });

  socket.on("error", (error) => {
    console.error("\n❌ ========== BROWSER SOCKET ERROR ==========");
    console.error(`🆔 Socket ID: ${socket.id}`);
    console.error(`📞 Call ID: ${callId || "not registered"}`);
    console.error(`❌ Error: `, error.message);
    console.error(`   Stack: `, error.stack);
    console.error("============================================\n");
  });

  console.log("=================================================\n");
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
  if (callId) {
    vonageConnections.set(callId, ws);
    console.log(
      `✅✅✅ Vonage connection IMMEDIATELY stored for call ${callId}`
    );
    console.log(`📊 Total Vonage connections NOW: ${vonageConnections.size}`);
    console.log(
      `📋 All stored callIds: `,
      Array.from(vonageConnections.keys())
    );
  } else {
    console.error(`❌ No callId in URL params!  Cannot store connection.`);
  }
  // Send initial acknowledgment to Vonage
  const ackMessage = {
    event: "connection_acknowledged",
    callId: callId,
  };
  ws.send(JSON.stringify(ackMessage));
  console.log("📤 Connection acknowledgment sent to Vonage:", ackMessage);

  // ✅ Initialize transcriptions map for this call
  if (!activeTranscriptions.has(callId)) {
    activeTranscriptions.set(callId, {});
    console.log(`📋 Initialized transcriptions map for call ${callId}`);
  }

  // Initialize audio buffer for this call
  if (!audioBuffers.has(callId)) {
    audioBuffers.set(callId, []);
    console.log(`📋 Initialized audio buffer for call ${callId}`);
  }

  // ✅ Start transcription for phone user with async handling
  const startPhoneTranscription = async () => {
    try {
      console.log(`🎙️ Starting phone transcription for call ${callId}...`);

      const phoneTranscription = await transcriptionService.startTranscription(
        callId,
        "phone",
        handleTranscription
      );

      console.log(`✅ Phone transcription object created for call ${callId}`);
      console.log(`🔍 Transcription state: `, {
        hasStream: !!phoneTranscription?.stream,
        streamDestroyed: phoneTranscription?.stream?.destroyed,
        streamWritable: phoneTranscription?.stream?.writable,
      });

      activeTranscriptions.get(callId).phone = phoneTranscription;

      // Wait a bit for stream to be fully ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log(
        `✅ Phone transcription fully initialized for call ${callId}`
      );
      console.log(
        `📊 Active transcriptions count: ${activeTranscriptions.size}`
      );

      // Process buffered audio chunks
      const bufferedChunks = audioBuffers.get(callId) || [];
      if (bufferedChunks.length > 0) {
        console.log(
          `📦 Processing ${bufferedChunks.length} buffered audio chunks for call ${callId}`
        );

        for (const chunk of bufferedChunks) {
          if (isStreamHealthy(phoneTranscription.stream)) {
            phoneTranscription.stream.write(chunk);
          }
        }

        console.log(`✅ Buffered chunks processed for call ${callId}`);
        audioBuffers.set(callId, []); // Clear buffer
      }

      return phoneTranscription;
    } catch (error) {
      console.error(
        `❌ Failed to start phone transcription for call ${callId}:`,
        error.message
      );
      console.error(`   Error stack:`, error.stack);
      return null;
    }
  };

  // Start transcription asynchronously
  startPhoneTranscription();

  ws.on("message", (message) => {
    try {
      // Try to parse as JSON (control messages)
      const data = JSON.parse(message.toString());

      console.log("\n📨 ========== VONAGE JSON MESSAGE ==========");
      console.log("📞 Call ID:", callId);
      console.log("📨 Event:", data.event);
      console.log("📊 Data:", JSON.stringify(data, null, 2));

      if (data.event === "websocket: connected") {
        // Extract callId from headers if not in URL
        if (!callId) {
          callId = data.callId || data.headers?.callId;
          console.log(`📝 Call ID extracted from message: ${callId}`);
        }
        console.log(`✅ Vonage websocket connected confirmed:  ${callId}`);
        vonageConnections.set(callId, ws);
        console.log(`📊 Total Vonage connections: ${vonageConnections.size}`);

        // Check if browser is already connected
        const browserSocket = browserSockets.get(callId);
        if (browserSocket) {
          console.log(
            `✅ Browser socket FOUND for call ${callId} (Socket ID: ${browserSocket.id})`
          );
        } else {
          console.log(`⚠️ Browser socket NOT FOUND YET for call ${callId}`);
          console.log(
            `📋 Available browser sockets: `,
            Array.from(browserSockets.keys())
          );
        }

        // Send acknowledgment back to Vonage
        const ackMsg = { event: "websocket:connected: ack" };
        ws.send(JSON.stringify(ackMsg));
        console.log("📤 Acknowledgment sent to Vonage:", ackMsg);
      }

      if (data.event === "audio:start") {
        console.log(`🎤 Audio stream started for call ${callId}`);
        console.log(`   Audio format details: `, JSON.stringify(data, null, 2));
      }

      if (data.event === "audio:stop") {
        console.log(`🎤 Audio stream stopped for call ${callId}`);
      }

      if (data.event === "websocket:error") {
        console.error(`❌ Vonage WebSocket error for call ${callId}:`);
        console.error(`   Error data: `, JSON.stringify(data, null, 2));
      }

      console.log("==========================================\n");
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
              transcriptions.phone.stream.write(message);

              // Log occasionally
              if (Math.random() < 0.01) {
                console.log(
                  `📝 Phone audio written to transcription stream (${message.length} bytes)`
                );
              }
            } catch (err) {
              console.error(
                `❌ Error writing to phone transcription for call ${callId}:`,
                err.message
              );
              console.error(`   Error stack:`, err.stack);
            }
          } else {
            // Buffer the audio chunk - FIX: Access the phone array properly
            const buffers = audioBuffers.get(callId);
            if (buffers) {
              if (!buffers.phone) buffers.phone = []; // Initialize if needed
              buffers.phone.push(message); // Push to the phone array

              // Only log occasionally to avoid spam
              if (Math.random() < 0.01) {
                console.warn(
                  `⚠️ Buffering phone audio for call ${callId} (buffer size: ${buffers.phone.length} chunks)`
                );
                console.log(`🔍 Phone transcription state:`, {
                  hasTranscription: !!transcriptions?.phone,
                  hasStream: !!transcriptions?.phone?.stream,
                  streamDestroyed: transcriptions?.phone?.stream?.destroyed,
                  streamWritable: transcriptions?.phone?.stream?.writable,
                });
              }
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
    console.log(`📞 Call ID: ${callId}`);
    console.log(`❌ Vonage WebSocket disconnected`);
    console.log(`   Close code: ${code}`);
    console.log(`   Close reason: ${reason || "No reason provided"}`);

    if (callId) {
      vonageConnections.delete(callId);
      console.log(`🗑️ Vonage connection removed for call ${callId}`);
      console.log(`📊 Remaining Vonage connections: ${vonageConnections.size}`);

      // Notify browser that call ended
      const browserSocket = browserSockets.get(callId);
      if (browserSocket && browserSocket.connected) {
        const endMessage = {
          callId: callId,
          reason: "Vonage disconnected",
        };
        browserSocket.emit("call:ended", endMessage);
        console.log(`📤 Call ended notification sent to browser: `, endMessage);
      } else {
        console.log(
          `⚠️ No connected browser socket to notify for call ${callId}`
        );
      }

      // ✅ Close phone transcription
      const transcriptions = activeTranscriptions.get(callId);
      if (transcriptions?.phone) {
        try {
          transcriptions.phone.close();
          console.log(`✅ Phone transcription closed for call ${callId}`);
        } catch (err) {
          console.error(
            `❌ Error closing phone transcription for call ${callId}:`,
            err.message
          );
        }
        delete transcriptions.phone;
      }

      // Clean up if both transcriptions are closed
      if (transcriptions && !transcriptions.phone && !transcriptions.browser) {
        activeTranscriptions.delete(callId);
        console.log(`🧹 Cleaned up all transcriptions for call ${callId}`);
        console.log(
          `📊 Remaining active transcriptions: ${activeTranscriptions.size}`
        );
      }

      // Clean up audio buffer
      audioBuffers.delete(callId);
      console.log(`🗑️ Audio buffer cleared for call ${callId}`);
    }
    console.log("=============================================\n");
  });

  ws.on("error", (error) => {
    console.error("\n❌ ========== VONAGE WEBSOCKET ERROR ==========");
    console.error(`📞 Call ID: ${callId}`);
    console.error(`❌ Error message:`, error.message);
    console.error(`   Error code:`, error.code);
    console.error(`   Stack:`, error.stack);
    console.error("=============================================\n");
  });

  // Handle ping/pong for connection health
  ws.on("ping", () => {
    ws.pong();
    if (Math.random() < 0.1) {
      console.log(`🏓 Ping received from Vonage for call ${callId}, pong sent`);
    }
  });

  ws.on("pong", () => {
    // Connection is alive
    if (Math.random() < 0.1) {
      console.log(`🏓 Pong received from Vonage for call ${callId}`);
    }
  });
});

// Optional: Add periodic cleanup of stale connections
setInterval(() => {
  let closedCount = 0;
  wss.clients.forEach((ws) => {
    if (ws.readyState === 3) {
      // CLOSED
      closedCount++;
      console.log("🧹 Cleaning up closed WebSocket connection");
    }
  });

  if (closedCount > 0) {
    console.log(
      `🧹 Cleanup cycle complete:  ${closedCount} closed connections removed`
    );
  }
}, 30000); // Check every 30 seconds

console.log("⏰ WebSocket cleanup interval started (runs every 30 seconds)");

// =========================
// :  silhouette:  CREATE VONAGE USER
// =========================
/**
 * Vonage requires users for in-app or client SDK calls.
 * This function creates a user on the Vonage application.
 *
 * @param {string} username - The name of the user to create.
 */
async function createUser(username) {
  console.log(`\n👤 ========== CREATING VONAGE USER ==========`);
  console.log(`👤 Username: ${username}`);

  try {
    const userResponse = await vonage.users.createUser({
      name: username,
      displayName: username,
    });
    console.log("✅ User created successfully");
    console.log("📊 User details:", JSON.stringify(userResponse, null, 2));
    console.log("===========================================\n");
    return userResponse;
  } catch (e) {
    console.error("❌ Error creating user:", e.message);
    console.error("   Error details:", e);
    console.error("===========================================\n");
    throw e;
  }
}

app.post("/api/user", async (req, res) => {
  console.log("\n📝 ========== POST /api/user ==========");
  console.log("📊 Request body:", req.body);

  const { username } = req.body;
  if (!username) {
    console.warn("⚠️  Username is required but not provided");
    return res.status(400).json({ error: "username is required" });
  }

  try {
    const userResponse = await createUser(username);
    const response = {
      message: "User created successfully",
      user: userResponse,
    };
    console.log("📤 Sending response:", response);
    console.log("======================================\n");
    res.json(response);
  } catch (err) {
    console.error("❌ Error creating user:", err.message);
    console.error("======================================\n");
    res.status(500).json({ error: "User creation failed" });
  }
});

// =========================
// : globe_with_meridians: GET:   /api/user
// =========================
/**
 * Test endpoint to create a Vonage user (for demonstration).
 * In real-world use, you would trigger this only once per unique user.
 */
app.get("/api/user", async (req, res) => {
  console.log("\n📝 ========== GET /api/user ==========");
  console.log("🧪 Creating test user:  voip_user_1");

  try {
    await createUser("voip_user_1");
    const response = { message: "User 'voip_user_1' created successfully" };
    console.log("📤 Sending response:", response);
    console.log("=====================================\n");
    res.json(response);
  } catch (err) {
    console.error("❌ Error generating user:", err.message);
    console.error("=====================================\n");
    res.status(500).json({ error: "User generation failed" });
  }
});

// =========================
// : key: GET: /api/token
// =========================
app.get("/api/token", (req, res) => {
  console.log("\n🔐 ========== GET /api/token ==========");

  try {
    const now = Math.floor(Date.now() / 1000);
    const jti = Math.random().toString(36).substring(2);
    const payload = {
      application_id: VONAGE_APPLICATION_ID,
      iat: now,
      nbf: now,
      exp: now + 60 * 60,
      jti: jti,
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

    console.log("🔐 JWT payload:", JSON.stringify(payload, null, 2));

    const token = jwt.sign(payload, privateKey, { algorithm: "RS256" });
    console.log("✅ JWT token generated successfully");
    console.log("⏰ Token expires in:  1 hour");
    console.log("📤 Sending token to client");
    console.log("======================================\n");

    res.json({ token });
  } catch (err) {
    console.error("❌ Error generating JWT:", err.message);
    console.error("   Stack:", err.stack);
    console.error("======================================\n");
    res.status(500).json({ error: "Token generation failed" });
  }
});

// =========================
// : phone:   GET: /answer
// =========================
app.get("/answer", async (req, res) => {
  console.log("\n🎉 ========== ANSWER WEBHOOK CALLED ==========");
  console.log("📞 Vonage is calling our /answer endpoint!");
  console.log("📊 Full query params:", req.query);

  const { to_user_id, from_user_id, uuid, session_id, callId } = req.query;

  console.log("📞 Parsed params:", {
    callId,
    from_user_id,
    to_user_id,
    session_id,
    uuid,
  });

  // ✅ Get your current ngrok URL from environment or hardcode it
  const NGROK_URL =
    process.env.NGROK_URL || "https://d6942579588b.ngrok-free.app";
  console.log("🌐 Using NGROK_URL:", NGROK_URL);

  // ✅ Construct WebSocket URL properly - NO SPACES!
  const wsUrl = `wss://d6942579588b.ngrok-free.app/socket/vonage?callId=${callId}&sessionId=${session_id}&fromUserId=${from_user_id}&toUserId=${to_user_id}`;

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
  console.log("⏰ Waiting for Vonage WebSocket connection...");
  console.log("=============================================\n");

  res.json(ncco);
});

// =========================
// :satellite_antenna: POST: /event
// =========================
app.post("/event", async (req, res) => {
  console.log("\n📡 ========== EVENT WEBHOOK CALLED ==========");
  console.log("📊 Event timestamp:", new Date().toISOString());
  console.log("📊 Event data:", JSON.stringify(req.body, null, 2));
  console.log("📊 Event status:", req.body.status);
  console.log("📊 Event type:", req.body.type);
  console.log("📊 Event UUID:", req.body.uuid);
  console.log("📊 Event direction:", req.body.direction);
  console.log("===============================================\n");

  res.sendStatus(200);
});

// =========================
// POST: /recording
// =========================
app.post("/recording", async (req, res) => {
  console.log("\n🎙️  ========== RECORDING EVENT ==========");
  console.log(
    "📊 Recording event received:",
    JSON.stringify(req.body, null, 2)
  );
  console.log("📊 Recording URL:", req.body.recording_url);
  console.log("📊 Recording UUID:", req.body.recording_uuid);
  console.log("=======================================\n");

  res.sendStatus(200);
});

// =========================
// :  phone: POST: /api/hangup
// =========================
app.post("/api/hangup", async (req, res) => {
  console.log("\n📞 ========== HANGUP REQUEST ==========");
  console.log("📊 Request body:", req.body);

  try {
    const { call_uuid } = req.body;

    if (!call_uuid) {
      console.warn("⚠️  call_uuid is required but not provided");
      return res.status(400).json({ error: "call_uuid is required" });
    }

    console.log(`📞 Attempting to hangup call:  ${call_uuid}`);
    const token = generateVonageJWT();

    console.log(`📤 Sending hangup request to Vonage API...`);
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

    console.log("📊 Vonage API Response:");
    console.log("   Status:", response.status);
    console.log("   Result:", result);

    if (!response.ok) {
      console.error("❌ Failed to hang up call");
      console.error("   Response status:", response.status);
      console.error("   Response details:", result);
      console.log("======================================\n");
      return res.status(response.status).json({
        error: "Failed to hang up call",
        details: result,
      });
    }

    console.log("✅ Call successfully hung up");
    console.log("======================================\n");
    return res.json({
      message: "Call successfully hung up",
      result,
    });
  } catch (error) {
    console.error("❌ Hangup Error:", error.message);
    console.error("   Stack:", error.stack);
    console.log("======================================\n");
    return res
      .status(500)
      .json({ error: "Server error while hanging up call" });
  }
});

// =========================
// : phone: POST: /api/call
// =========================
// https
app.post("/api/call", async (req, res) => {
  console.log("\n📞 ========== OUTBOUND CALL REQUEST ==========");
  console.log("📊 Request body:", req.body);

  const { to, from_user_id, to_user_id, session_id } = req.body;
  console.log("📞 Call params:", { to, from_user_id, to_user_id, session_id });

  const callId = randomUUID();
  console.log("🆔 Generated Call ID:", callId);

  const NGROK_URL = "https://d6942579588b.ngrok-free.app";
  console.log("🌐 Using NGROK_URL:", NGROK_URL);

  try {
    const answerUrl = `${NGROK_URL}/answer?callId=${callId}&from_user_id=${encodeURIComponent(
      from_user_id
    )}&to_user_id=${encodeURIComponent(
      to_user_id
    )}&session_id=${encodeURIComponent(session_id)}`;

    const eventUrl = `${NGROK_URL}/event`;

    console.log("🔗 Answer URL:", answerUrl);
    console.log("🔗 Event URL:", eventUrl);

    console.log("📤 Sending call request to Vonage API...");
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
      answerUrl: [answerUrl],
      eventUrl: [eventUrl],
    });

    console.log("✅ Call created successfully!");
    console.log("📞 Call UUID:", result.uuid);
    console.log("📞 Call Status:", result.status);
    console.log("📞 Call Direction:", result.direction);
    console.log("📞 Conversation UUID:", result.conversationUuid);
    console.log("⏰ Now waiting for phone to be answered...");
    console.log("============================================\n");

    res.json({ ...result, callId });
  } catch (err) {
    console.error("❌ Error creating call");
    console.error("   Error message:", err.message);
    console.error(
      "   Error response:",
      err.response?.data || "No response data"
    );
    console.error("   Error stack:", err.stack);
    console.log("============================================\n");

    res
      .status(500)
      .json({ error: "Failed to place call", details: err.message });
  }
});

// =========================
// :rocket: START EXPRESS SERVER
// =========================
const PORT = process.env.PORT || 3000;
console.log("\n🚀 ========== STARTING SERVER ==========");
console.log(`🌐 Port: ${PORT}`);
console.log(`🔗 Base URL: https://d6942579588b.ngrok-free.app`);

server.listen(PORT, () => {
  console.log("\n✅ ========== SERVER STARTED SUCCESSFULLY ==========");
  console.log("🚀 Server running on port " + PORT);
  console.log("📡 Socket.IO available at https://d6942579588b.ngrok-free.app");
  console.log(
    "🧪 Test page:   https://d6942579588b.ngrok-free.app/test-socket"
  );
  console.log(
    "🔌 WebSocket endpoint: wss://d6942579588b.ngrok-free.app/socket/vonage"
  );
  console.log(
    "🌐 Browser namespace: https://d6942579588b.ngrok-free.app/browser"
  );
  console.log("\n📋 Available endpoints:");
  console.log("   GET  /");
  console.log("   GET  /test-socket");
  console.log("   GET  /api/user");
  console.log("   POST /api/user");
  console.log("   GET  /api/token");
  console.log("   GET  /answer");
  console.log("   POST /event");
  console.log("   POST /recording");
  console.log("   POST /api/hangup");
  console.log("   POST /api/call");
  console.log("\n📊 System Status:");
  console.log(`   Active transcriptions: ${activeTranscriptions.size}`);
  console.log(`   Browser sockets: ${browserSockets.size}`);
  console.log(`   Vonage connections: ${vonageConnections.size}`);
  console.log("===================================================\n");
});

// Handle server errors
server.on("error", (error) => {
  console.error("\n❌ ========== SERVER ERROR ==========");
  console.error("Error:", error.message);
  console.error("Stack:", error.stack);
  console.error("====================================\n");
});

// Handle process termination
process.on("SIGTERM", () => {
  console.log("\n⚠️  ========== SIGTERM RECEIVED ==========");
  console.log("🛑 Shutting down gracefully...");

  server.close(() => {
    console.log("✅ Server closed");
    console.log("🧹 Cleaning up resources...");
    console.log("   Active transcriptions:", activeTranscriptions.size);
    console.log("   Browser sockets:", browserSockets.size);
    console.log("   Vonage connections:", vonageConnections.size);
    console.log("=========================================\n");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\n⚠️  ========== SIGINT RECEIVED ==========");
  console.log("🛑 Shutting down gracefully...");

  server.close(() => {
    console.log("✅ Server closed");
    console.log("🧹 Cleaning up resources...");
    console.log("   Active transcriptions:", activeTranscriptions.size);
    console.log("   Browser sockets:", browserSockets.size);
    console.log("   Vonage connections:", vonageConnections.size);
    console.log("========================================\n");
    process.exit(0);
  });
});
