// At the top with other imports
import TranscriptionService from "./transcription-service. js";

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

// Update Browser Socket. IO Handler
browserIO.on("connection", (socket) => {
  console.log("✅ Browser connected:", socket.id);

  let callId = null;

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
    try {
      const browserTranscription =
        await transcriptionService.startTranscription(
          callId,
          "browser",
          handleTranscription
        );

      // Store transcription reference
      if (!activeTranscriptions.has(callId)) {
        activeTranscriptions.set(callId, {});
      }
      activeTranscriptions.get(callId).browser = browserTranscription;

      console.log(`✅ Browser transcription started for call ${callId}`);
    } catch (error) {
      console.error("Failed to start browser transcription:", error);
    }
  });

  // ✅ Receive microphone data and send to transcription
  socket.on("microphone: data", (data) => {
    const micCallId = data.callId;

    // Send to Vonage WebSocket
    const vonageWs = vonageConnections.get(micCallId);
    if (vonageWs && vonageWs.readyState === 1) {
      const binaryString = atob(data.audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      vonageWs.send(bytes.buffer);
    }

    // ✅ Send to browser transcription stream
    const transcriptions = activeTranscriptions.get(micCallId);
    if (transcriptions && transcriptions.browser) {
      const binaryString = atob(data.audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Write to transcription stream
      transcriptions.browser.stream.write(Buffer.from(bytes.buffer));
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`❌ Browser disconnected: ${socket.id}, reason: ${reason}`);

    if (callId) {
      browserSockets.delete(callId);

      // ✅ Close browser transcription
      const transcriptions = activeTranscriptions.get(callId);
      if (transcriptions && transcriptions.browser) {
        transcriptions.browser.close();
        delete transcriptions.browser;
      }
    }
  });
});

// Update Vonage WebSocket Handler
wss.on("connection", async (ws, req) => {
  console.log("\n📡 ========== VONAGE WEBSOCKET CONNECTED ==========");

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

  // ✅ Start transcription for phone user
  try {
    const phoneTranscription = await transcriptionService.startTranscription(
      callId,
      "phone",
      handleTranscription
    );

    // Store transcription reference
    if (!activeTranscriptions.has(callId)) {
      activeTranscriptions.set(callId, {});
    }
    activeTranscriptions.get(callId).phone = phoneTranscription;

    console.log(`✅ Phone transcription started for call ${callId}`);
  } catch (error) {
    console.error("Failed to start phone transcription:", error);
  }

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.event === "websocket: connected") {
        if (!callId) {
          callId = data.callId || data.headers?.callId;
        }
        console.log(`✅ Vonage websocket connected:  ${callId}`);
        vonageConnections.set(callId, ws);
      }

      if (data.event === "audio:start") {
        console.log(`🎤 Audio stream started for call ${callId}`);
      }
    } catch (err) {
      // Binary audio data from phone
      if (callId && message.length > 0) {
        const browserSocket = browserSockets.get(callId);

        // Send to browser
        if (browserSocket && browserSocket.connected) {
          const audioBase64 = message.toString("base64");
          browserSocket.emit("audio:data", {
            audio: audioBase64,
            binary: true,
            size: message.length,
          });
        }

        // ✅ Send to phone transcription stream
        const transcriptions = activeTranscriptions.get(callId);
        if (transcriptions && transcriptions.phone) {
          transcriptions.phone.stream.write(message);
        }
      }
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`\n❌ Vonage WebSocket closed for call ${callId}`);

    if (callId) {
      vonageConnections.delete(callId);

      const browserSocket = browserSockets.get(callId);
      if (browserSocket && browserSocket.connected) {
        browserSocket.emit("call:ended", { callId });
      }

      // ✅ Close phone transcription
      const transcriptions = activeTranscriptions.get(callId);
      if (transcriptions && transcriptions.phone) {
        transcriptions.phone.close();
        delete transcriptions.phone;
      }

      // Clean up if both transcriptions are closed
      if (transcriptions && !transcriptions.phone && !transcriptions.browser) {
        activeTranscriptions.delete(callId);
      }
    }
  });

  ws.on("error", (error) => {
    console.error(`❌ Vonage WebSocket error: `, error);
  });
});
