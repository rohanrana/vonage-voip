// src/hooks/useVonageCall.js
import { useRef, useState } from "react";
import { io } from "socket.io-client";

export const useVonageCall = (session) => {
  const [call, setCall] = useState(null);
  const [callId, setCallId] = useState(null);
  const [callStatus, setCallStatus] = useState("idle");
  const [transcriptions, setTranscriptions] = useState([]);
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const localProcessorRef = useRef(null);
  const localSourceRef = useRef(null);
  const micStreamRef = useRef(null);

  // Start call
  const startCall = async (phoneNumber) => {
    console.log("🎯 startCall function called");
    console.log("   Phone number:", phoneNumber);

    if (!session) {
      const errorMsg = "No session available.  Please login first.";
      console.error("❌", errorMsg);
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      console.log("📞 Starting call to:", phoneNumber);
      setCallStatus("connecting");
      setTranscriptions([]);
      setError(null);

      console.log("📞 Calling session.serverCall.. .");

      // Make the call
      const newCall = await session.serverCall({ to: phoneNumber });

      console.log("✅ Call initiated");
      setCall(newCall);

      // Get call ID from conversation
      const conversationId =
        newCall?.id || newCall?.conversation?.id || `call-${Date.now()}`;
      setCallId(conversationId);

      console.log("   Conversation ID:", conversationId);

      // Connect to transcription server
      connectToTranscription(conversationId);

      // Set status to ringing
      setCallStatus("ringing");

      // Start capturing browser audio immediately
      setTimeout(() => {
        console.log("🎤 Starting browser audio capture.. .");
        setupBrowserAudioCapture(conversationId);
      }, 1000);

      // Simulate answered status after 3 seconds (adjust as needed)
      setTimeout(() => {
        console.log("✅ Assuming call answered");
        setCallStatus("answered");
      }, 3000);

      return newCall;
    } catch (err) {
      console.error("❌ Failed to start call:", err);
      setError(err.message);
      setCallStatus("failed");
      throw err;
    }
  };

  // Connect to Socket.IO for transcription
  const connectToTranscription = (conversationId) => {
    const SOCKET_URL = "http://localhost:3002";
    console.log("🔌 Connecting to transcription server");
    console.log("   📋 Registering with Call ID:", conversationId);

    console.log("🔌 Connecting to transcription server");

    const socket = io(`${SOCKET_URL}/browser`, {
      transports: ["polling"],
      reconnection: true,
      path: "/socket.io/",
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Connected to transcription server");
      console.log("✅ Connected to transcription server");
      console.log("   📋 Emitting register with Call ID:", conversationId);
      socket.emit("register", { callId: conversationId });
    });

    socket.on("registered", (data) => {
      console.log("✅ Registered for transcription:", data);
    });

    socket.on("transcription", (data) => {
      console.log(`📝 Transcription event received! `);
      console.log(`   Speaker: ${data.speaker}`);
      console.log(`   Transcript: ${data.transcript}`);
      console.log(`   Is Final: ${data.isFinal}`);

      setTranscriptions((prev) => {
        if (!data.isFinal) {
          const filtered = prev.filter(
            (t) => t.isFinal || t.speaker !== data.speaker
          );
          return [...filtered, data];
        }
        return [...prev, data];
      });
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from transcription server");
    });
  };

  // Setup browser audio capture (microphone only)
  const setupBrowserAudioCapture = async (conversationId) => {
    try {
      console.log("🎤 Setting up browser audio capture");

      // Get microphone access
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      micStreamRef.current = micStream;
      console.log("✅ Microphone access granted");

      // Create audio context
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)({
        sampleRate: 16000,
      });

      await audioContextRef.current.resume();
      console.log("✅ Audio context created");

      // Capture and send audio
      captureBrowserAudio(micStream, conversationId);
    } catch (err) {
      console.error("❌ Failed to setup browser audio:", err);
      setError("Microphone access denied:  " + err.message);
    }
  };

  // Capture browser audio and send to server
  const captureBrowserAudio = (stream, conversationId) => {
    try {
      console.log("🎤 Starting browser audio capture");

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(
        2048,
        1,
        1
      );

      localSourceRef.current = source;
      localProcessorRef.current = processor;

      let packetCount = 0;
      let firstPacketLogged = false;

      processor.onaudioprocess = (e) => {
        if (!socketRef.current || !socketRef.current.connected) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        const sampleRate = audioContextRef.current.sampleRate;

        if (!firstPacketLogged) {
          console.log("🎤 First browser audio packet");
          console.log("   Sample rate:", sampleRate);
          console.log("   Buffer length:", inputData.length);
          firstPacketLogged = true;
        }

        // Resample if needed
        let outputData = inputData;
        if (sampleRate !== 16000) {
          outputData = resampleBuffer(inputData, sampleRate, 16000);
        }

        // Convert to Int16
        const int16Data = new Int16Array(outputData.length);
        for (let i = 0; i < outputData.length; i++) {
          let sample = outputData[i];
          if (sample > 1) sample = 1;
          if (sample < -1) sample = -1;
          int16Data[i] = sample * 32767;
        }

        // Convert to base64
        const base64 = btoa(
          new Uint8Array(int16Data.buffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ""
          )
        );

        // Send to server
        socketRef.current.emit("audio:transcribe", {
          audio: base64,
          callId: conversationId,
          speaker: "browser",
        });

        packetCount++;
        if (packetCount % 50 === 0) {
          console.log(`🎤 Sent ${packetCount} browser audio packets`);
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      console.log("✅ Browser audio capture started");
    } catch (err) {
      console.error("❌ Failed to capture browser audio:", err);
    }
  };

  // Resample audio buffer
  const resampleBuffer = (buffer, fromRate, toRate) => {
    if (fromRate === toRate) return buffer;

    const ratio = fromRate / toRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const position = i * ratio;
      const index = Math.floor(position);
      const fraction = position - index;

      if (index + 1 < buffer.length) {
        result[i] =
          buffer[index] * (1 - fraction) + buffer[index + 1] * fraction;
      } else {
        result[i] = buffer[index];
      }
    }

    return result;
  };

  // End call
  const endCall = () => {
    console.log("📞 Ending call");

    if (call) {
      if (typeof call.hangup === "function") {
        call.hangup();
      } else if (typeof call.hangUp === "function") {
        call.hangUp();
      }
    }

    cleanup();
  };

  // Cleanup
  const cleanup = () => {
    console.log("🧹 Cleaning up");

    // Stop microphone
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    // Stop processor
    if (localProcessorRef.current) {
      localProcessorRef.current.disconnect();
      localProcessorRef.current = null;
    }

    // Stop source
    if (localSourceRef.current) {
      localSourceRef.current.disconnect();
      localSourceRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Disconnect socket
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setCall(null);
    setCallId(null);
    setCallStatus("idle");
  };

  return {
    call,
    callId,
    callStatus,
    transcriptions,
    error,
    startCall,
    endCall,
  };
};
