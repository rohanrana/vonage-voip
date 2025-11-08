

// ✅ --- Your React App starts below ---
import React, { useEffect, useRef, useState } from "react";
import { getVonageToken } from "./api";
import {
  VonageClient,
  ClientConfig,
  ConfigRegion,
  LoggingLevel,
} from "@vonage/client-sdk";
import "bootstrap/dist/css/bootstrap.min.css";
// import "bootstrap-icons/font/bootstrap-icons.css"; // ✅ for phone icons
// ✅ --- Silence Vonage internal noise ---
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

function isVonageNoise(args) {
  return args.some(
    (a) =>
      typeof a === "string" &&
      (a.includes("VonageConsoleLogger::vonage.core") ||
        a.includes("UnknownSocketEvent") ||
        a.includes("IllegalArgumentException"))
  );
}

console.error = (...args) => {
  if (isVonageNoise(args)) return;
  originalError(...args);
};

console.warn = (...args) => {
  if (isVonageNoise(args)) return;
  originalWarn(...args);
};

console.log = (...args) => {
  if (isVonageNoise(args)) return;
  originalLog(...args);
};
function App() {
  const [status, setStatus] = useState("Initializing...");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [callId, setCallId] = useState(null);
  const [error, setError] = useState(null);
  const [session, setSession] = useState();
  const [isSystemOk, setIsSystemOk] = useState(false);

  const [config] = useState(() => new ClientConfig(ConfigRegion.US));
  const [client] = useState(() => {
    const c = new VonageClient({
      region: ConfigRegion.US,
      loggingLevel: LoggingLevel.NONE, // ✅ reduce SDK log level
    });
    c.setConfig(config);
    return c;
  });

  const audioCtx = useRef(null);

  // 🌍 Country selector data
  const [country, setCountry] = useState({
    code: "IN",
    name: "India",
    dial_code: "+91",
    flag: "🇮🇳",
  });

  const countries = [
    { code: "IN", name: "India", dial_code: "+91", flag: "🇮🇳" },
    { code: "US", name: "United States", dial_code: "+1", flag: "🇺🇸" },
    { code: "GB", name: "United Kingdom", dial_code: "+44", flag: "🇬🇧" },
    { code: "CA", name: "Canada", dial_code: "+1", flag: "🇨🇦" },
    { code: "AU", name: "Australia", dial_code: "+61", flag: "🇦🇺" },
    { code: "SG", name: "Singapore", dial_code: "+65", flag: "🇸🇬" },
    { code: "AE", name: "UAE", dial_code: "+971", flag: "🇦🇪" },
  ];

  const [logs, setLogs] = useState([]);
  const wsRef = useRef(null);

  // 🔌 Function to initialize WebSocket connection
  const initWebSocket = () => {
    const ws = new WebSocket("wss://8710b6908dfb.ngrok-free.app/ws");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ Connected to WS server");
      setLogs((prev) => [...prev, "✅ Connected to WS server"]);

      // 🔁 Keep connection alive with ping every 30 seconds
      const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ ping: true }));
        }
      }, 30000);

      ws.onclose = () => clearInterval(interval);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log("📩 Socket message:", msg);

        if (msg.type === "vonage-event") {
          // setLogs((prev) => [...prev, `📡 ${JSON.stringify(msg.data)}`]);
          setStatus(msg?.data?.status)

        }
        
        // else if (msg.type === "info") {
        //   setLogs((prev) => [...prev, msg.message]);
        // } else {
        //   setLogs((prev) => [...prev, event.data]);
        // }
      } catch {
        setLogs((prev) => [...prev, event.data]);
      }
    };

    ws.onerror = (err) => {
      console.error("❌ WS Error:", err);
      setLogs((prev) => [...prev, "❌ WebSocket error"]);
    };
  };

  // // 🔴 Optional: Function to close WebSocket
  // const closeWebSocket = () => {
  //   if (wsRef.current) {
  //     wsRef.current.close();
  //     setLogs((prev) => [...prev, "🔌 WebSocket closed"]);
  //   }
  // };

  useEffect(() => {
    if(client){
    initClient();
    }
  }, [client]);

  const initClient = async () => {
    try {
      const token = await getVonageToken();
      const sessionObj = await client.createSession(token);
      setSession(sessionObj);
      setStatus("Ready to make calls");
      setIsSystemOk(true);
      initWebSocket()
    } catch (err) {
      console.error("❌ Init error:", err);
      setError(err);
      setStatus("Failed to initialize");
    }
  };

  const makeCall = async () => {
    if (!session || !phoneNumber) {
      alert("Please enter a valid phone number");
      return;
    }

    try {
      setIsCalling(true);
      setStatus("Calling...");

      const fullNumber = `${country.dial_code}${phoneNumber}`; // ✅ Include country code

      const newCallId = await client.serverCall({ to: fullNumber });
      setCallId(newCallId);
    } catch (err) {
      console.error("❌ Call error:", err);
      setStatus("Call failed");
      setIsCalling(false);
    }
  };

  useEffect(() => {
    client.on("legStatusUpdate", (callId, legId, legStatus) => {
      console.log(`☎️ Status: ${legStatus}`);
      if (legStatus === "ANSWERED") setStatus("Call connected");
      if (legStatus === "COMPLETED" || legStatus === "REMOTE_REJECT") {
        // setStatus("Call ended");
        setIsCalling(false);
        setCallId(null);
      }
    });

    client.on("callHangup", () => {
      setStatus("Call ended");
      setIsCalling(false);
      setCallId(null);
    });

    client.on("disconnect", (reason) => {
      setStatus("Call disconnected");
    });
  }, [client]);

  const endCall = async () => {
    if (!callId) {
      alert("No active call to hang up");
      return;
    }

    try {
      await client.hangup(callId);
      console.log("✅ Call hung up successfully");
      setCallId(null);
      setStatus("Call ended");
    } catch (err) {
      console.error("❌ Error hanging up call:", err);
    }
  };

  // ----------------------------
  // 🎵 DTMF tone frequencies
  // ----------------------------
  const dtmfFrequencies = {
    "1": [697, 1209],
    "2": [697, 1336],
    "3": [697, 1477],
    "4": [770, 1209],
    "5": [770, 1336],
    "6": [770, 1477],
    "7": [852, 1209],
    "8": [852, 1336],
    "9": [852, 1477],
    "*": [941, 1209],
    "0": [941, 1336],
    "#": [941, 1477],
  };

  const playDTMFTone = (digit) => {
    if (!dtmfFrequencies[digit]) return;
    if (!audioCtx.current)
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();

    const [f1, f2] = dtmfFrequencies[digit];
    const duration = 0.15; // 150ms tone
    const ctx = audioCtx.current;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.frequency.value = f1;
    osc2.frequency.value = f2;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + duration);
    osc2.stop(ctx.currentTime + duration);
  };

  const handleDigitPress = (digit) => {
    if (!isCalling) setPhoneNumber((prev) => prev + digit);
    playDTMFTone(digit);
  };

  const handleDelete = () => {
    if (!isCalling) setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (!isCalling) setPhoneNumber("");
  };

  const dialPadKeys = [
    { num: "1", text: "" },
    { num: "2", text: "ABC" },
    { num: "3", text: "DEF" },
    { num: "4", text: "GHI" },
    { num: "5", text: "JKL" },
    { num: "6", text: "MNO" },
    { num: "7", text: "PQRS" },
    { num: "8", text: "TUV" },
    { num: "9", text: "WXYZ" },
    { num: "*", text: "" },
    { num: "0", text: "+" },
    { num: "#", text: "" },
  ];


  return (
    <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
      <div
        className="card shadow-lg border-0"
        style={{
          width: "21rem",
          borderRadius: "1rem",
          background: "#fefefe",
        }}
      >
        <div className="card-body text-center">
          <h4 className="fw-bold text-primary mb-3">VoIP Call Demo</h4>

          <div className="text-muted mb-2">
            <small>
              Status: <span className="fw-semibold">{logs?.status ? logs.status:status}</span>
            </small>
          </div>

          {/* 🌍 Country Selector */}
          <div className="mb-3">
            <select
              className="form-select text-center"
              style={{ borderRadius: "0.5rem" }}
              value={country.code}
              onChange={(e) => {
                const selected = countries.find(
                  (c) => c.code === e.target.value
                );
                setCountry(selected);
              }}
              disabled={isCalling}
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name} ({c.dial_code})
                </option>
              ))}
            </select>
          </div>

          <div className="fs-4 fw-bold mb-3 border-bottom pb-2">
            {phoneNumber ? (
              <>
                <span className="text-secondary">{country.dial_code}</span>{" "}
                {phoneNumber}
              </>
            ) : (
              <span className="text-secondary">Enter number</span>
            )}
          </div>

          {/* Dial Pad */}
          <div className="container">
            <div className="row row-cols-3 g-3">
              {dialPadKeys.map((key) => (
                <div className="col" key={key.num}>
                  <button
                    className="btn btn-light border shadow-sm w-100"
                    style={{
                      height: "70px",
                      fontSize: "24px",
                      fontWeight: "500",
                      position: "relative",
                    }}
                    onClick={() => handleDigitPress(key.num)}
                    disabled={isCalling}
                  >
                    <div>{key.num}</div>
                    {key.text && (
                      <small
                        style={{
                          position: "absolute",
                          bottom: "6px",
                          left: 0,
                          right: 0,
                          fontSize: "11px",
                          color: "#666",
                        }}
                      >
                        {key.text}
                      </small>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="mt-4 d-flex justify-content-center gap-3">
            {!isCalling ? (
              <>
                <button
                  className="btn btn-success p-3 fs-4"
                  disabled={!isSystemOk || !phoneNumber}
                  onClick={makeCall}
                >
                  <i className="bi bi-telephone-fill"></i>
                </button>
                <button
                  className="btn btn-secondary p-3 fs-4"
                  onClick={handleDelete}
                  disabled={!phoneNumber}
                >
                  ⌫
                </button>
                <button
                  className="btn btn-warning p-3 fs-4"
                  onClick={handleClear}
                  disabled={!phoneNumber}
                >
                  ❌
                </button>
              </>
            ) : (
              <button
                className="btn btn-danger rounded-circle p-3 fs-4"
                onClick={endCall}
              >
                <i className="bi bi-telephone-x-fill"></i>
              </button>
            )}
          </div>

          {error && (
            <div className="alert alert-danger mt-3 py-2">
              ⚠️ {error.message || "Error initializing client"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
