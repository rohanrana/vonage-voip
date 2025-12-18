// index.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { WebSocketServer } from "ws";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import { Vonage } from "@vonage/server-sdk";
import { tokenGenerate } from "@vonage/jwt";
import { Auth } from "@vonage/auth";
import TranscriptionService from "./transcription-service.js";
import jwt from "jsonwebtoken";

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration
const APP_ID = process.env.APP_ID;
const VONAGE_NUMBER = process.env.VONAGE_NUMBER;
const PRIVATE_KEY_PATH = process.env.PRIVATE_KEY_PATH;
const PORT = process.env.PORT || 3002;
const NGROK_URL = process.env.NGROK_URL;

// Initialize Vonage
console.log("PRIVATE_KEY_PATH", PRIVATE_KEY_PATH);
const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCbeTUWr5SOpitV
OtUYwkIBXpIvnGnIwj4MCDDaPw+MFjlZIFGKNk0SXyV//f0ORmf+CdrkAT4+y7op
PbFGNT2fgxcuwgOVEe3CGo+PLMqcfeSZ7biGpt4H1WWCMbTEbDdxhmruWqzuPbhE
NH+mQQBsRm0FjKPplRrKgJTrQEsrI2GzyIx9XpOJGxfkiHo6XUy+X3AQHhXZz0Yj
rYRjh8xVs62BjMioX6eE0rJ748ONriJfEYjTMzVucV5PaMVVCMagy8mGNDEZMUkM
wnPy115llUzot8yBDBt48BbzyK+NuvA7R0BPrSfQqd701eQFVs8HDkid2xKfHFUZ
11VvgdgFAgMBAAECggEAPSz61kPdXSoGeAFv00+wwDAxrnlJ6JyB5KMeceoJWJJw
G2FLpGpMdlOpAk1zEvhiOAQxtLDGiNgKFus3A4y0hD0FVLkzxqbo2o0v+uLhkKU6
29S93IHxcLyntgyP+BAq2slM7yAP1qjDhlbv+X+vRmuJv3rBDorEoXTp5A2G5mBn
LCof9Jtvtirou0KTnoaN3L/qooykUkxH6WaRA2v6ZFFYgxVUzDqE2GmcUbuJua4X
RAEJvH7j86gZOjtMz2xHOGb04WGdfO0K16S9r87h7s7U3eqwQ5Np+QHIDwaJgC6k
GMytBqjWif+qKGGC9bBytnCa10EPzr701sXUGjthGwKBgQDLQrrVTBHbMABFN1Ba
a+yp6AWmlVVm6gx/qutqIoE97FJoU6XVh0zlNMTNqMg84vaxnVkacZJgYhzDlIsf
Vybvn4JMuQ5cUKUZIVG2ZJBae/DUZDDkJPRcoMxe/4+i0PGJz67rwu3BeZQCLZex
MqRoUxo1Z5940/yOAR73XkQjRwKBgQDD0Em/69v/XesWrUkhggclFJE3mngVv8f+
tUAYeiW3BrXT3rLlrBJyEjPl7t7gLJKC8Ac6BkVnA3wZ7hSXMBvCXAQJ0K6TcQnK
INz/zhgkJQovHif9tKwVYuA3oXufNR0vAv+XOR3WCy3nnlIsf1LNZuE3Ipj8dS5T
SFMo82ZYUwKBgCX7z1xCved+/d3xa0OqfWx23m914qK7xCAreZi43/wJaJD0aL4R
ba47gTeJffna1Az3AYquhJMcYpGt9Z2itLT80uWxg1x++YtLrbBu9IbkOGoIWxaX
TU7uAaMTEO11LF37gI2wPKv2I1GQ4ZMMiqqwNOqb9bInsz96OCYz6HnLAoGAJYb1
m2KIdxh4xY/QRCu3UtPuQMnJ2eE3Ywk5j3dZYwpWLpSvlHS11EbIy3hMHopsScvW
lrg89NEmJ5IJQDBoIYeg/oCP9JHlXmeN8zh8R/ERUpZk86p8kFyyu/amyoxTW38n
nMPFhBAAbDNbbEu6gsMExpxK1ZdfmXZy+ZYsNyECgYAga6exz9ZOHsF6F7ojURez
OiZOwgBBkruebbK6AmfrIrWw/d8ju8CVu0qsymATrvfigi8vWPJVCpAhtXqj2wUV
EYCaIkf5SjZocZHmhqQrWekVtrR5rwtwucA6GQ5zWN2s43fxdTv0S8w7jWRn4gjO
qiRGBg3Ew+Y4+TOQ5Sr2Sg==
-----END PRIVATE KEY-----`;
// const vonagePrivateKey = fs.readFileSync(PRIVATE_KEY_PATH, "utf8");
const vonage = new Vonage(
  new Auth({
    applicationId: APP_ID,
    privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCbeTUWr5SOpitV
OtUYwkIBXpIvnGnIwj4MCDDaPw+MFjlZIFGKNk0SXyV//f0ORmf+CdrkAT4+y7op
PbFGNT2fgxcuwgOVEe3CGo+PLMqcfeSZ7biGpt4H1WWCMbTEbDdxhmruWqzuPbhE
NH+mQQBsRm0FjKPplRrKgJTrQEsrI2GzyIx9XpOJGxfkiHo6XUy+X3AQHhXZz0Yj
rYRjh8xVs62BjMioX6eE0rJ748ONriJfEYjTMzVucV5PaMVVCMagy8mGNDEZMUkM
wnPy115llUzot8yBDBt48BbzyK+NuvA7R0BPrSfQqd701eQFVs8HDkid2xKfHFUZ
11VvgdgFAgMBAAECggEAPSz61kPdXSoGeAFv00+wwDAxrnlJ6JyB5KMeceoJWJJw
G2FLpGpMdlOpAk1zEvhiOAQxtLDGiNgKFus3A4y0hD0FVLkzxqbo2o0v+uLhkKU6
29S93IHxcLyntgyP+BAq2slM7yAP1qjDhlbv+X+vRmuJv3rBDorEoXTp5A2G5mBn
LCof9Jtvtirou0KTnoaN3L/qooykUkxH6WaRA2v6ZFFYgxVUzDqE2GmcUbuJua4X
RAEJvH7j86gZOjtMz2xHOGb04WGdfO0K16S9r87h7s7U3eqwQ5Np+QHIDwaJgC6k
GMytBqjWif+qKGGC9bBytnCa10EPzr701sXUGjthGwKBgQDLQrrVTBHbMABFN1Ba
a+yp6AWmlVVm6gx/qutqIoE97FJoU6XVh0zlNMTNqMg84vaxnVkacZJgYhzDlIsf
Vybvn4JMuQ5cUKUZIVG2ZJBae/DUZDDkJPRcoMxe/4+i0PGJz67rwu3BeZQCLZex
MqRoUxo1Z5940/yOAR73XkQjRwKBgQDD0Em/69v/XesWrUkhggclFJE3mngVv8f+
tUAYeiW3BrXT3rLlrBJyEjPl7t7gLJKC8Ac6BkVnA3wZ7hSXMBvCXAQJ0K6TcQnK
INz/zhgkJQovHif9tKwVYuA3oXufNR0vAv+XOR3WCy3nnlIsf1LNZuE3Ipj8dS5T
SFMo82ZYUwKBgCX7z1xCved+/d3xa0OqfWx23m914qK7xCAreZi43/wJaJD0aL4R
ba47gTeJffna1Az3AYquhJMcYpGt9Z2itLT80uWxg1x++YtLrbBu9IbkOGoIWxaX
TU7uAaMTEO11LF37gI2wPKv2I1GQ4ZMMiqqwNOqb9bInsz96OCYz6HnLAoGAJYb1
m2KIdxh4xY/QRCu3UtPuQMnJ2eE3Ywk5j3dZYwpWLpSvlHS11EbIy3hMHopsScvW
lrg89NEmJ5IJQDBoIYeg/oCP9JHlXmeN8zh8R/ERUpZk86p8kFyyu/amyoxTW38n
nMPFhBAAbDNbbEu6gsMExpxK1ZdfmXZy+ZYsNyECgYAga6exz9ZOHsF6F7ojURez
OiZOwgBBkruebbK6AmfrIrWw/d8ju8CVu0qsymATrvfigi8vWPJVCpAhtXqj2wUV
EYCaIkf5SjZocZHmhqQrWekVtrR5rwtwucA6GQ5zWN2s43fxdTv0S8w7jWRn4gjO
qiRGBg3Ew+Y4+TOQ5Sr2Sg==
-----END PRIVATE KEY-----`,
  })
);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Initialize AWS Transcription Service
const transcriptionService = new TranscriptionService(
  process.env.AWS_REGION || "us-east-1",
  process.env.AWS_ACCESS_KEY_ID,
  process.env.AWS_SECRET_ACCESS_KEY
);

// Check AWS configuration
console.log("\n🔐 ========== AWS CREDENTIALS CHECK ==========");
console.log("AWS_REGION:", process.env.AWS_REGION || "NOT SET");
console.log(
  "AWS_ACCESS_KEY_ID:",
  process.env.AWS_ACCESS_KEY_ID ? "✅ SET" : "❌ NOT SET"
);
console.log(
  "AWS_SECRET_ACCESS_KEY:",
  process.env.AWS_SECRET_ACCESS_KEY ? "✅ SET" : "❌ NOT SET"
);
console.log("=============================================\n");

// Storage Maps
const browserSockets = new Map();
const vonageConnections = new Map();
const activeTranscriptions = new Map();

// Transcription callback handler
const handleTranscription = (data) => {
  // console.log(
  //   `📝 [${data.speaker}] ${data.isFinal ? "FINAL" : "PARTIAL"}: ${
  //     data.transcript
  //   }`
  // );
  console.log(`\n📝 ========== TRANSCRIPTION CALLBACK ==========`);
  console.log(`   Speaker: ${data.speaker}`);
  console.log(`   Transcript: ${data.transcript}`);
  console.log(`   Is Final: ${data.isFinal}`);
  console.log(`   Call ID: ${data.callId}`);
  console.log(`==============================================\n`);

  // Send transcription to browser via Socket.IO
  const browserSocket = browserSockets.get(data.callId);

  console.log(`   Browser socket exists:  ${!!browserSocket}`);
  console.log(`   Browser socket connected: ${browserSocket?.connected}`);
  console.log(`   Browser socket ID: ${browserSocket?.id}`);
  console.log(`   All browser sockets: `, Array.from(browserSockets.keys()));

  if (browserSocket && browserSocket.connected) {
    browserSocket.emit("transcription", {
      speaker: data.speaker,
      transcript: data.transcript,
      isFinal: data.isFinal,
      timestamp: data.timestamp,
    });
    console.log(`   ✅ Transcription emitted successfully`);
  } else {
    console.error(`   ❌ No connected browser socket for call ${data.callId}`);
  }
};

// Helper to ensure browser transcription exists
const ensureBrowserTranscription = async (callId) => {
  if (!activeTranscriptions.has(callId)) {
    activeTranscriptions.set(callId, {});
  }

  const transcriptions = activeTranscriptions.get(callId);

  if (
    transcriptions.browser?.stream &&
    !transcriptions.browser.stream.destroyed
  ) {
    return transcriptions.browser;
  }

  try {
    console.log(`🎙️ Starting browser transcription for call ${callId}`);
    const browserTranscription = await transcriptionService.startTranscription(
      callId,
      "browser",
      handleTranscription
    );

    transcriptions.browser = browserTranscription;
    console.log(`✅ Browser transcription started`);
    return browserTranscription;
  } catch (error) {
    console.error(`❌ Failed to start browser transcription: `, error.message);
    return null;
  }
};

// Helper to ensure phone transcription exists
const ensurePhoneTranscription = async (callId) => {
  if (!activeTranscriptions.has(callId)) {
    activeTranscriptions.set(callId, {});
  }

  const transcriptions = activeTranscriptions.get(callId);

  if (transcriptions.phone?.stream && !transcriptions.phone.stream.destroyed) {
    return transcriptions.phone;
  }

  try {
    console.log(`🎙️ Starting phone transcription for call ${callId}`);
    const phoneTranscription = await transcriptionService.startTranscription(
      callId,
      "phone",
      handleTranscription
    );

    transcriptions.phone = phoneTranscription;
    console.log(`✅ Phone transcription started`);
    return phoneTranscription;
  } catch (error) {
    console.error(`❌ Failed to start phone transcription:`, error.message);
    return null;
  }
};

// ========== SOCKET. IO BROWSER NAMESPACE ==========
const browserIO = io.of("/browser");

// Store audio buffers
const audioBuffers = new Map(); // callId -> { browser:  [], phone: [] }

browserIO.on("connection", (socket) => {
  console.log("✅ Browser connected:", socket.id);

  let callId = null;

  socket.on("register", (data) => {
    callId = data.callId;
    console.log(`📞 Browser registered for call ${callId}`);
    browserSockets.set(callId, socket);

    // Initialize transcriptions map
    if (!activeTranscriptions.has(callId)) {
      activeTranscriptions.set(callId, {});
    }

    // Initialize audio buffer
    if (!audioBuffers.has(callId)) {
      audioBuffers.set(callId, { browser: [], phone: [] });
    }

    socket.emit("registered", {
      callId,
      status: "connected",
      socketId: socket.id,
    });
  });

  // Receive audio from browser for transcription
  socket.on("audio:transcribe", async (data) => {
    const { callId, speaker, audio } = data;

    if (!callId || !speaker || !audio) {
      console.error("❌ Missing required fields:", {
        callId,
        speaker,
        hasAudio: !!audio,
      });
      return;
    }

    // Decode audio once
    let audioBuffer;
    try {
      const binaryString = atob(audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      audioBuffer = Buffer.from(bytes.buffer);
    } catch (err) {
      console.error(`❌ Error decoding audio: `, err.message);
      return;
    }

    // Get or create transcription
    const transcriptions = activeTranscriptions.get(callId);
    let transcription;

    if (speaker === "browser") {
      transcription = transcriptions?.browser;
    } else if (speaker === "phone") {
      transcription = transcriptions?.phone;
    }

    // If transcription doesn't exist, buffer the audio
    if (
      !transcription ||
      !transcription.stream ||
      transcription.stream.destroyed
    ) {
      // Buffer audio
      const buffers = audioBuffers.get(callId);
      if (buffers) {
        buffers[speaker] = buffers[speaker] || [];
        buffers[speaker].push(audioBuffer);

        // Start transcription after buffering 10 packets (~200ms of audio)
        if (buffers[speaker].length === 10) {
          console.log(
            `\n🎙️ ========== STARTING ${speaker.toUpperCase()} TRANSCRIPTION ==========`
          );
          console.log(`   Buffered ${buffers[speaker].length} packets`);
          console.log(
            `   Total buffered bytes: ${buffers[speaker].reduce(
              (sum, buf) => sum + buf.length,
              0
            )}`
          );
          console.log(`===============================================\n`);

          // Start transcription
          if (speaker === "browser") {
            transcription = await ensureBrowserTranscription(callId);
          } else {
            transcription = await ensurePhoneTranscription(callId);
          }

          // Send all buffered audio
          if (transcription?.stream && !transcription.stream.destroyed) {
            console.log(
              `📤 Sending ${buffers[speaker].length} buffered packets to AWS`
            );
            for (const buf of buffers[speaker]) {
              transcription.stream.write(buf);
            }
            // Clear buffer
            buffers[speaker] = [];
            console.log(`✅ Buffer cleared, streaming live audio now`);
          }
        } else {
          // Log buffering progress occasionally
          if (buffers[speaker].length % 5 === 0) {
            console.log(
              `📦 Buffering ${speaker} audio:  ${buffers[speaker].length}/10 packets`
            );
          }
        }
      }
    } else {
      // Transcription exists, send audio directly
      try {
        transcription.stream.write(audioBuffer);
      } catch (err) {
        console.error(
          `❌ Error writing to ${speaker} transcription: `,
          err.message
        );
      }
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`❌ Browser disconnected: ${socket.id}, reason: ${reason}`);

    if (callId) {
      browserSockets.delete(callId);
      audioBuffers.delete(callId);

      // Close all transcriptions for this call
      const transcriptions = activeTranscriptions.get(callId);
      if (transcriptions) {
        if (transcriptions.browser) {
          transcriptions.browser.close();
        }
        if (transcriptions.phone) {
          transcriptions.phone.close();
        }
        activeTranscriptions.delete(callId);
      }
    }
  });

  socket.on("error", (error) => {
    console.error("❌ Socket error:", error);
  });
});

// server/index.js

// WebSocket handler for Vonage (native WebSocket)
const wss = new WebSocketServer({
  server,
  path: "/socket/vonage",
});

console.log("🔌 WebSocket server created on path:  /socket/vonage");

wss.on("connection", async (ws, req) => {
  console.log("\n📡 ========== VONAGE WEBSOCKET CONNECTED ==========");

  const urlParts = req.url.split("?");
  const params = new URLSearchParams(urlParts[1] || "");
  const callId = params.get("callId");
  const speaker = params.get("speaker") || "phone";

  console.log("📞 WebSocket params:", { callId, speaker });

  // Initialize transcriptions map
  if (!activeTranscriptions.has(callId)) {
    activeTranscriptions.set(callId, {});
  }

  ws.on("message", async (message) => {
    try {
      // Try to parse as JSON (control messages)
      const data = JSON.parse(message.toString());

      if (data.event === "websocket: connected") {
        console.log(`✅ Vonage WebSocket connected for call ${callId}`);
        vonageConnections.set(callId, ws);
      }

      if (data.event === "audio:start") {
        console.log(`🎤 Phone audio stream started for call ${callId}`);
      }
    } catch (err) {
      // Binary audio data from phone
      if (callId && message.length > 0) {
        // Start phone transcription on first audio (lazy)
        const phoneTranscription = await ensurePhoneTranscription(callId);

        // Send to transcription
        if (
          phoneTranscription?.stream &&
          !phoneTranscription.stream.destroyed
        ) {
          try {
            phoneTranscription.stream.write(message);
          } catch (err) {
            console.error(
              `❌ Error writing to phone transcription: `,
              err.message
            );
          }
        }

        // Also send to browser client for playback (if needed)
        const browserSocket = browserSockets.get(callId);
        if (browserSocket && browserSocket.connected) {
          const audioBase64 = message.toString("base64");
          browserSocket.emit("audio:data", {
            audio: audioBase64,
            size: message.length,
            speaker: "phone",
          });
        }
      }
    }
  });

  ws.on("close", () => {
    console.log(`❌ Vonage WebSocket closed for call ${callId}`);
    vonageConnections.delete(callId);

    // Close phone transcription
    const transcriptions = activeTranscriptions.get(callId);
    if (transcriptions?.phone) {
      transcriptions.phone.close();
      delete transcriptions.phone;
    }
  });

  ws.on("error", (error) => {
    console.error(`❌ Vonage WebSocket error: `, error);
  });
});

// ========== HTTP ROUTES ==========

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Vonage Voice Server with AWS Transcribe",
    timestamp: new Date().toISOString(),
  });
});

// Generate JWT token for Client SDK authentication
app.post("/api/generate-token", (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  try {
    // const jwt = tokenGenerate(APP_ID, privateKey, {
    //   sub: username,
    //   acl: {
    //     paths: {
    //       "/*/users/**": {},
    //       "/*/conversations/**": {},
    //       "/*/sessions/**": {},
    //       "/*/devices/**": {},
    //       "/*/image/**": {},
    //       "/*/media/**": {},
    //       "/*/applications/**": {},
    //       "/*/push/**": {},
    //       "/*/knocking/**": {},
    //       "/*/legs/**": {},
    //     },
    //   },
    // });
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      application_id: APP_ID,
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

    console.log(`✅ JWT generated for user: ${username}`);

    res.json({
      token: token,
      username,
    });
  } catch (error) {
    console.error("❌ Error generating JWT:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

// Answer webhook for Vonage calls
// server/index.js

app.get("/answer", (req, res) => {
  console.log("\n📞 ========== ANSWER WEBHOOK CALLED ==========");

  const { from, to, conversation_uuid, uuid } = req.query;

  console.log("📞 Client SDK Call");
  console.log("   From (browser):", from);
  console.log("   To (phone):", to);
  console.log("   Conversation UUID:", conversation_uuid);

  const NGROK_URL = process.env.NGROK_URL;
  const callId = conversation_uuid;

  // WebSocket URL to capture phone audio
  const wsUrl = `${NGROK_URL.replace(
    "https",
    "wss"
  )}/socket/vonage?callId=${callId}&speaker=phone`;

  console.log("========WEBSOCKET URL=========");
  console.log("WebSocket URL:", wsUrl);
  console.log("=============================");
  console.log("Call ID:", callId);
  console.log("=============================");

  // NCCO with WebSocket to capture phone audio
  const ncco = [
    {
      action: "talk",
      text: "Connecting your call",
      bargeIn: false,
      language: "en-US",
    },
    {
      action: "connect",
      from: VONAGE_NUMBER,
      timeout: 45,
      endpoint: [
        // {
        //   type: "phone",
        //   number: to,
        // },
        // ✅ Add WebSocket to capture phone audio
        {
          type: "websocket",
          uri: wsUrl,
          "content-type": "audio/l16;rate=16000",
          headers: {
            callId: callId,
            speaker: "phone",
          },
        },
      ],
      eventUrl: [`${NGROK_URL}/event`],
      eventMethod: "POST",
    },
  ];

  console.log("📤 Returning NCCO:", JSON.stringify(ncco, null, 2));
  res.json(ncco);
});

// Event webhook for call status updates
app.post("/event", (req, res) => {
  console.log("\n📡 ========== CALL EVENT ==========");
  console.log("Event:", JSON.stringify(req.body, null, 2));
  console.log("==================================\n");

  res.sendStatus(200);
});

// Test AWS Transcribe endpoint
app.post("/api/test-transcribe", async (req, res) => {
  console.log("🧪 Testing AWS Transcribe...");

  try {
    const testCallId = "test-" + Date.now();

    const transcription = transcriptionService.startTranscription(
      testCallId,
      "test",
      (data) => {
        console.log("📝 Test transcription:", data);
      }
    );

    // Send some test audio (silence)
    const testAudio = Buffer.alloc(320); // 20ms of silence at 16kHz
    transcription.stream.write(testAudio);

    setTimeout(() => {
      transcription.close();
      res.json({ success: true, message: "Test transcription started" });
    }, 2000);
  } catch (error) {
    console.error("❌ Test failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== START SERVER ==========
server.listen(PORT, () => {
  console.log("\n🚀 ========== SERVER STARTED ==========");
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready`);
  console.log(`🔐 Vonage App ID: ${APP_ID}`);
  console.log(`📞 Vonage Number: ${VONAGE_NUMBER}`);
  console.log(`🌐 NGROK URL: ${NGROK_URL}`);
  console.log(`🎙️ AWS Transcribe:  ${process.env.AWS_REGION}`);
  console.log("======================================\n");
});
