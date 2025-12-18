import React, { useEffect, useRef, useState } from "react";
import { getVonageToken } from "./api";
import {
  VonageClient,
  ClientConfig,
  ConfigRegion,
  LoggingLevel,
} from "@vonage/client-sdk";
import "bootstrap/dist/css/bootstrap.min.css";
import { useCallAudio } from "./hooks/useCallAudioWS";
import DecorativePanel from "./components/DecorativePanel";
import CallAnimation from "./components/CallAnimation";
import DialPad from "./components/DialPad";
import TranscriptionPanel from "./components/TranscriptionPanel";
import "./components/styles/animations.css";

// Silence Vonage internal noise
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

function isVonageNoise(args) {
  return args.some(
    (a) =>
      typeof a === "string" &&
      (a.includes("VonageConsoleLogger:: vonage.core") ||
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
      loggingLevel: LoggingLevel.NONE,
    });
    c.setConfig(config);
    return c;
  });

  const audioCtx = useRef(null);

  const {
    isConnected,
    callStatus,
    isMicrophoneActive,
    transcriptions,
    toggleMute,
    isMuted,
  } = useCallAudio(callId);

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

  useEffect(() => {
    if (client) {
      initClient();
    }
    // eslint-disable-next-line
  }, [client]);

  const initClient = async () => {
    try {
      const token = await getVonageToken();
      const sessionObj = await client.createSession(token);
      setSession(sessionObj);
      setStatus("Ready to make calls");
      setIsSystemOk(true);
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

      const res = await fetch("https://d6942579588b.ngrok-free.app/api/call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "+917874056406",
          from_user_id: "1111",
          to_user_id: "2222",
          session_id: session,
        }),
      });

      if (!res.ok) {
        setStatus("Call failed");
        return;
      }

      const data = await res.json();
      console.log("🚀 ~ makeCall ~ data:", data);
      setCallId(data.callId);
    } catch (err) {
      console.error("❌ Call error:", err);
      setStatus("Call failed");
      setIsCalling(false);
    }
  };

  useEffect(() => {
    client.on("legStatusUpdate", (callId, legId, legStatus) => {
      console.log(`☎️ Status:  ${legStatus}`);
      if (legStatus === "ANSWERED") setStatus("Call connected");
      if (legStatus === "COMPLETED" || legStatus === "REMOTE_REJECT") {
        setIsCalling(false);
        setCallId(null);
      }
    });

    client.on("callHangup", () => {
      setStatus("Call ended");
      setIsCalling(false);
      setCallId(null);
    });

    client.on("disconnect", () => {
      setStatus("Call disconnected");
    });
  }, [client]);

  const endCall = async () => {
    if (!callId) {
      alert("No active call to hang up");
      return;
    }
    console.log("Attempting to hang up call:", callId);
    try {
      await client.hangup(callId);
      console.log("✅ Call hung up successfully");
      setCallId(null);
      setStatus("Call ended");
    } catch (err) {
      console.error("❌ Error hanging up call:", err);
    }
  };

  const dtmfFrequencies = {
    1: [697, 1209],
    2: [697, 1336],
    3: [697, 1477],
    4: [770, 1209],
    5: [770, 1336],
    6: [770, 1477],
    7: [852, 1209],
    8: [852, 1336],
    9: [852, 1477],
    "*": [941, 1209],
    0: [941, 1336],
    "#": [941, 1477],
  };

  const playDTMFTone = (digit) => {
    if (!dtmfFrequencies[digit]) return;
    if (!audioCtx.current)
      audioCtx.current = new (window.AudioContext ||
        window.webkitAudioContext)();

    const [f1, f2] = dtmfFrequencies[digit];
    const duration = 0.15;
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
  useEffect(() => {
    if (callStatus === "ended") {
      setIsCalling(false);
    }
  }, [callStatus]);

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center p-4"
      style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <div className="d-flex gap-4">
        {/* Decorative Panel or Calling Animation */}
        {!isCalling && <DecorativePanel />}

        {isCalling && (
          <CallAnimation
            phoneNumber={phoneNumber}
            country={country}
            isMicrophoneActive={isMicrophoneActive}
            isMuted={isMuted}
            toggleMute={toggleMute}
          />
        )}

        {/* Dial Pad */}
        <DialPad
          isCalling={isCalling}
          status={status}
          callStatus={callStatus}
          country={country}
          countries={countries}
          setCountry={setCountry}
          phoneNumber={phoneNumber}
          handleDigitPress={handleDigitPress}
          isSystemOk={isSystemOk}
          makeCall={makeCall}
          handleDelete={handleDelete}
          handleClear={handleClear}
          endCall={endCall}
          error={error}
          isMuted={isMuted}
          toggleMute={toggleMute}
        />

        {/* Transcription Panel */}
        {isCalling && (
          <TranscriptionPanel
            transcriptions={transcriptions}
            isConnected={isConnected}
            isMicrophoneActive={isMicrophoneActive}
            isMuted={isMuted}
            toggleMute={toggleMute}
          />
        )}
      </div>
    </div>
  );
}

export default App;
