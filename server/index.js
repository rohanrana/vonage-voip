// server/index.js
import express from "express";
import fs from "fs";
import jwt from "jsonwebtoken";
import path from "path";
import bodyParser from "body-parser";
import cors from "cors";
import { fileURLToPath } from "url";
import { Vonage } from "@vonage/server-sdk";
import expressWs from "express-ws";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import WebSocket from "ws"; // ✅ Correct import
import axios from "axios";
// require("dotenv").config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// const app = express();
const expressApp = express();
const wsInstance = expressWs(expressApp);
const { app, getWss } = wsInstance;

app.use(bodyParser.json());
app.use(cors());

// =========================
// 🔧 MANUAL ENV VARIABLES
// =========================
const VONAGE_APPLICATION_ID = '4b5387d0-eee8-43ba-8771-5c2c4ee9d28f'; // replace with your real Application ID
const VONAGE_NUMBER = '12345678901';  // e.g. '14155550123'
const VONAGE_PRIVATE_KEY_PATH = path.join(__dirname, 'private.key'); // key file path
const DEEPGRAM_API_KEY = "9c3cdc284fb9d4ef00a8a70c4bc70a1219621e2f"
const DEEPGRAM_ASR_LANGUAGE = "en-US";
const DEEPGRAM_ASR_MODEL = "nova-3";
const DEEPGRAM_ASR_PUNCTUATE = true

console.log("VONAGE_PRIVATE_KEY_PATH", VONAGE_PRIVATE_KEY_PATH)
const privateKey = fs.readFileSync(
    VONAGE_PRIVATE_KEY_PATH,
    "utf8"
);
const vonage = new Vonage(
    {
        applicationId: VONAGE_APPLICATION_ID,
        privateKey: privateKey
    }
);

const deepgramClient = createClient(DEEPGRAM_API_KEY);


async function createUser(username) {
    try {
        const userResponse = await vonage.users.createUser({
            name: username,
            displayName: username
        });
        console.log("userResponse", userResponse)
        return userResponse
    } catch (e) {
        console.log("create user error", e);
    }
}

app.ws("/ws", (ws, req) => {
    console.log("✅ WebSocket connected");
    ws.send(JSON.stringify({ type: "info", message: "Connected to server logs" }));
});

app.get("/api/user", (req, res) => {
    try {
        const userResponse = createUser("test_voip_2")
        res.json({ user: "user created" });

    } catch {
        console.error("Error generating JWT:", err);
        res.status(500).json({ error: "user generation failed" });
    }
})

// Create short-lived JWT for client SDK
app.get("/api/token", (req, res) => {
    // createUser("user_rohan")
    try {
        const now = Math.floor(Date.now() / 1000);

        const payload = {
            application_id: VONAGE_APPLICATION_ID,
            iat: now,
            nbf: now,
            exp: now + 60 * 60, // valid for 1 hour
            jti: Math.random().toString(36).substring(2),
            sub: "test_voip_2",
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
                    "/*/legs/**": {}
                }
            }
        };

        const token = jwt.sign(payload, privateKey, { algorithm: "RS256" });

        res.json({ token });
    } catch (err) {
        console.error("Error generating JWT:", err);
        res.status(500).json({ error: "Token generation failed" });
    }
});


app.get("/answer", (req, res) => {
    const { to, endpoint_type, from_user, conversation_uuid, custom_data } = req.query;
    // const ncco = [
    //     {
    //         action: "talk",
    //         text: "Please wait while we connect you"
    //     },
    //     {
    //         action: "connect",
    //         from: VONAGE_NUMBER,
    //         eventUrl: ["https://8710b6908dfb.ngrok-free.app/event"], // ✅ 
    //         endpoint: [
    //             {
    //                 type: "phone",
    //                 number: to
    //             }
    //         ]
    //     },
    //     {
    //         action: "connect",
    //         endpoint: [
    //             {
    //                 type: "websocket",
    //                 uri: "wss://8710b6908dfb.ngrok-free.app/transcription-stream",
    //                 contentType: "audio/l16;rate=16000;channels=1"
    //             },
    //         ],
    //     },
    // ];
    //   res.json(ncco);
const ncco = [
  {
    action: "talk",
    text: "Please wait while we connect you",
  },
  {
    action: "connect",
    from: VONAGE_NUMBER,
    eventUrl: ["https://8710b6908dfb.ngrok-free.app/event"], // ✅ callback for call events
    endpoint: [
      {
        type: "phone",
        number: to, // e.g. "9198XXXXXXX"
      },
      {
        type: "websocket",
        uri: "wss://8710b6908dfb.ngrok-free.app/transcription-stream",
        contentType: "audio/l16;rate=16000;channels=1", // ✅ correct format
        headers: {
          app: "transcription",
          session: "call-123", // optional custom data
        },
      },
    ],
  },
];

    res.status(200).json(ncco);
});
// ✅ Handle Vonage WebSocket audio stream
// app.ws("/transcription-stream", async (clientWs, req) => {
//     console.log("🎧 Vonage WebSocket connected for transcription");

//     // 🔗 Connect to Deepgram’s live transcription API
//     const deepgramWs = new WebSocket("wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&sample_rate=16000&channels=1&language=en-US&punctuate=true", {
//         headers: {
//             Authorization: `Token ${DEEPGRAM_API_KEY}`,
//             "Content-Type": "application/json",
//         },
//     });

//     // --- Deepgram connection events ---
//     deepgramWs.on("open", () => {
//         console.log("✅ Connected to Deepgram Realtime API");
//     });

//     deepgramWs.on("message", (message) => {
//         try {
//             const msg = JSON.parse(message.toString());

//             if (msg.type === "Results") {
//                 const transcript = msg.channel?.alternatives?.[0]?.transcript;
//                 console.log(" Transcript:", msg);

//                 if (transcript && transcript.trim() !== "") {
//                     if (msg.is_final) {
//                         console.log("🟢 Final Transcript:", transcript);
//                     } else {
//                         console.log("🟡 Partial Transcript:", transcript);
//                     }
//                 }
//             } else if (msg.type === "Metadata") {
//                 console.log("ℹ️ Deepgram session started:", msg.request_id);
//             }
//         } catch (err) {
//             console.error("⚠️ Error parsing Deepgram message:", err);
//         }
//     });



//     deepgramWs.on("close", () => {
//         console.log("❌ Deepgram connection closed");
//     });

//     deepgramWs.on("error", (err) => {
//         console.error("⚠️ Deepgram error:", err);
//     });

//     // --- Forward audio from Vonage to Deepgram ---
//     //   clientWs.on("message", (message) => {
//     //     if (deepgramWs.readyState === WebSocket.OPEN) {
//     //       deepgramWs.send(message);
//     //     }
//     //   });
//     clientWs.on("message", (message, isBinary) => {
//         if (isBinary) {
//             console.log("🎧 Audio chunk:", data.length, "bytes");
//         }
//         if (!isBinary) {
//             // Ignore JSON/control messages
//             const text = message.toString();
//             if (text.includes("event")) console.log("⚙️ Vonage event:", text);
//             return;
//         }

//         if (deepgramWs.readyState === WebSocket.OPEN) {
//             deepgramWs.send(message);
//         }
//     });


//     clientWs.on("close", () => {
//         console.log("❌ Vonage stream closed");
//         if (deepgramWs.readyState === WebSocket.OPEN) {
//             deepgramWs.close();
//         }
//     });

//     clientWs.on("error", (err) => {
//         console.error("⚠️ Vonage WS error:", err);
//         if (deepgramWs.readyState === WebSocket.OPEN) {
//             deepgramWs.close();
//         }
//     });
// });
app.ws('/transcription-stream', async (ws, req) => {

    const peerUuid = req.query.peer_uuid;
    const webhookUrl = req.query.webhook_url;
    const user = req.query.user;
    const remoteParty = req.query.remote_party;

    //--

    console.log('>>> websocket connected with');
    console.log('>>> webhookUrl connected with', webhookUrl);

    console.log('peer call uuid:', peerUuid);

    //--

    console.log('Creating client connection to DeepGram');

    const deepgramClient = createClient(DEEPGRAM_API_KEY);

    console.log('Listening on Deepgram connection');

    let deepgram = deepgramClient.listen.live({
        model: DEEPGRAM_ASR_MODEL,
        smart_format: false,
        language: DEEPGRAM_ASR_LANGUAGE,
        encoding: "linear16",
        sample_rate: 16000,
        punctuate: DEEPGRAM_ASR_PUNCTUATE
    });

    console.log('Listener on connection to DeepGram');

    deepgram.addListener(LiveTranscriptionEvents.Open, async () => {
        console.log("deepgram: connected");

        deepgram.addListener(LiveTranscriptionEvents.Transcript, async (data) => {

            // console.log('\n');
            // console.log(JSON.stringify(data));

            const transcript = data.channel.alternatives[0].transcript;

            if (transcript != '') {
                console.log('\n>>> Transcript:', transcript);

                // post back transcript to Voice API app
                const response = await axios.post(webhookUrl,
                  {
                    "user": user,
                    "remoteParty": remoteParty,
                    "call_uuid": peerUuid, 
                    "transcript": transcript
                  },
                  {
                    headers: {
                      "Content-Type": 'application/json'
                    }
                  }
                );  
            }
        });

        deepgram.addListener(LiveTranscriptionEvents.Close, async () => {
            console.log("deepgram: disconnected");
            // clearInterval(keepAlive);
            deepgram.finish();
        });

        deepgram.addListener(LiveTranscriptionEvents.Error, async (error) => {
            console.log("deepgram: error received");
            console.error(error);
        });

        deepgram.addListener(LiveTranscriptionEvents.Warning, async (warning) => {
            console.log("deepgram: warning received");
            console.warn(warning);
        });

        deepgram.addListener(LiveTranscriptionEvents.Metadata, (data) => {
            console.log("deepgram: metadata received");
            console.log("ws: metadata sent to client");
            // ws.send(JSON.stringify({ metadata: data }));
            console.log(JSON.stringify({ metadata: data }));
        });

    });

    //---------------

    ws.on('message', async (msg) => {

        if (typeof msg === "string") {

            console.log("\n>>> Websocket text message:", msg);

        } else {

            if (deepgram.getReadyState() === 1 /* OPEN */) {
                deepgram.send(msg);
            } else if (deepgram.getReadyState() >= 2 /* 2 = CLOSING, 3 = CLOSED */) {
                // console.log("ws: data couldn't be sent to deepgram");
                null
            } else {
                // console.log("ws: data couldn't be sent to deepgram");
                null
            }

        }

    });

    //--

    ws.on('close', async () => {

        deepgram.finish();
        deepgram.removeAllListeners();
        deepgram = null;

        console.log("WebSocket closed");
    });

});




app.post("/event", (req, res) => {
    console.log("📡 Event received:", req.body);

    const { status, uuid, conversation_uuid, to, from } = req.body;

    if (status) {
        console.log(`➡️ Call ${status} | From: ${from} → To: ${to}`);
    } else {
        console.log("⚠️ Received event without status:", req.body);
    }
    const wss = getWss();
    wss.clients.forEach((client) => {
        try {
            client.send(JSON.stringify({
                type: "vonage-event",
                data: req.body
            }));
        } catch (err) {
            console.error("❌ WS send error:", err);
        }
    });

    res.sendStatus(200);
});



app.listen(3002, () => console.log("Server running on http://localhost:3002"));
