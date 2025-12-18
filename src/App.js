// src/components/VonageCallComponent. jsx
import { useState } from "react";
import { useVonageClient } from "./hooks/useVonageClient";
// import { useVonageClient } from "./hooks/useVonageClient";
import { useVonageCall } from "./hooks/useVonageCall";

function VonageCallComponent() {
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Use Vonage Client hook
  const {
    session,
    client,
    isAuthenticated,
    login,
    logout,
    error: authError,
  } = useVonageClient();

  // Use Vonage Call hook - pass the session
  const {
    call,
    callId,
    callStatus,
    transcriptions,
    error: callError,
    startCall,
    endCall,
  } = useVonageCall(client);

  // Handle login
  const handleLogin = async () => {
    console.log("🔐 Attempting login with username:", username);

    if (!username.trim()) {
      alert("Please enter a username");
      return;
    }

    try {
      const result = await login(username);
      console.log("✅ Login result:", result);
    } catch (err) {
      console.error("❌ Login error:", err);
      alert("Login failed: " + err.message);
    }
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    setUsername("");
    setPhoneNumber("");
  };

  // Handle start call
  const handleStartCall = async () => {
    console.log("📞 Handle start call clicked");
    console.log("   Phone number:", phoneNumber);
    console.log("   Session exists:", !!session);

    if (!phoneNumber.trim()) {
      alert("Please enter a phone number");
      return;
    }

    // Validate phone number format (E.164)
    if (!phoneNumber.startsWith("+")) {
      alert("Phone number must be in E.164 format (e.g., +14155551234)");
      return;
    }

    try {
      console.log("📞 Calling startCall function.. .");
      await startCall(phoneNumber);
    } catch (err) {
      console.error("❌ startCall error:", err);
      alert("Call failed: " + err.message);
    }
  };

  // Handle end call
  const handleEndCall = () => {
    endCall();
    setPhoneNumber("");
  };

  // Handle key press (Enter to submit)
  const handleKeyPress = (e, action) => {
    if (e.key === "Enter") {
      action();
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>📞 Vonage Voice Call with Live Transcription</h1>

      {/* Login Section */}
      {!isAuthenticated ? (
        <div style={{ marginTop: "20px" }}>
          <h2>Login</h2>
          <div style={{ marginBottom: "15px" }}>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => handleKeyPress(e, handleLogin)}
              style={{
                padding: "12px",
                width: "100%",
                fontSize: "16px",
                borderRadius: "5px",
                border: "1px solid #ddd",
              }}
            />
          </div>
          <button
            onClick={handleLogin}
            disabled={!username.trim()}
            style={{
              padding: "12px 24px",
              width: "100%",
              fontSize: "16px",
              backgroundColor: username.trim() ? "#4CAF50" : "#ccc",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: username.trim() ? "pointer" : "not-allowed",
            }}
          >
            Login
          </button>
          {authError && (
            <div
              style={{
                marginTop: "10px",
                padding: "10px",
                backgroundColor: "#ffebee",
                color: "#c62828",
                borderRadius: "5px",
              }}
            >
              ⚠️ {authError}
            </div>
          )}
        </div>
      ) : !call ? (
        /* Make Call Section */
        <div style={{ marginTop: "20px" }}>
          <div
            style={{
              padding: "15px",
              backgroundColor: "#e8f5e9",
              borderRadius: "8px",
              marginBottom: "20px",
            }}
          >
            <p style={{ margin: 0 }}>
              <strong>✅ Logged in as:</strong> {username}
            </p>
          </div>

          <h2>Make a Call</h2>
          <div style={{ marginBottom: "15px" }}>
            <input
              type="tel"
              placeholder="Phone number (e.g., +14155551234)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              onKeyPress={(e) => handleKeyPress(e, handleStartCall)}
              style={{
                padding: "12px",
                width: "100%",
                fontSize: "16px",
                borderRadius: "5px",
                border: "1px solid #ddd",
              }}
            />
            <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
              Must be in E.164 format (e.g., +1 for US, +44 for UK)
            </p>
          </div>

          <button
            onClick={handleStartCall}
            disabled={!phoneNumber.trim() || callStatus === "connecting"}
            style={{
              padding: "12px 24px",
              width: "100%",
              fontSize: "16px",
              backgroundColor:
                phoneNumber.trim() && callStatus !== "connecting"
                  ? "#2196F3"
                  : "#ccc",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor:
                phoneNumber.trim() && callStatus !== "connecting"
                  ? "pointer"
                  : "not-allowed",
              marginBottom: "10px",
            }}
          >
            {callStatus === "connecting" ? "Connecting..." : "📞 Start Call"}
          </button>

          <button
            onClick={handleLogout}
            style={{
              padding: "12px 24px",
              width: "100%",
              fontSize: "16px",
              backgroundColor: "#999",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Logout
          </button>

          {callError && (
            <div
              style={{
                marginTop: "15px",
                padding: "10px",
                backgroundColor: "#ffebee",
                color: "#c62828",
                borderRadius: "5px",
              }}
            >
              ⚠️ {callError}
            </div>
          )}
        </div>
      ) : (
        /* Active Call Section */
        <div style={{ marginTop: "20px" }}>
          {/* Call Status Card */}
          <div
            style={{
              padding: "20px",
              backgroundColor: "#f5f5f5",
              borderRadius: "8px",
              marginBottom: "20px",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Call in Progress</h2>
            <div style={{ display: "grid", gap: "10px" }}>
              <p style={{ margin: 0 }}>
                <strong>📞 Calling:</strong> {phoneNumber}
              </p>
              <p style={{ margin: 0 }}>
                <strong>🔌 Status:</strong>{" "}
                <span
                  style={{
                    color:
                      callStatus === "answered"
                        ? "green"
                        : callStatus === "connecting"
                        ? "orange"
                        : "red",
                    fontWeight: "bold",
                  }}
                >
                  {callStatus.toUpperCase()}
                </span>
              </p>
              {callId && (
                <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                  <strong>Call ID:</strong> {callId}
                </p>
              )}
            </div>
          </div>

          {/* Error Display */}
          {callError && (
            <div
              style={{
                padding: "15px",
                backgroundColor: "#ffebee",
                color: "#c62828",
                borderRadius: "8px",
                marginBottom: "20px",
              }}
            >
              <strong>⚠️ Error:</strong> {callError}
            </div>
          )}

          {/* Transcription Display */}
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: "8px",
              backgroundColor: "#fff",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                padding: "15px",
                borderBottom: "1px solid #ddd",
                backgroundColor: "#fafafa",
                borderTopLeftRadius: "8px",
                borderTopRightRadius: "8px",
              }}
            >
              <h3 style={{ margin: 0 }}>📝 Live Transcription</h3>
            </div>

            <div
              style={{
                padding: "15px",
                maxHeight: "400px",
                overflowY: "auto",
                minHeight: "200px",
              }}
            >
              {transcriptions.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    color: "#999",
                    fontStyle: "italic",
                    padding: "40px 20px",
                  }}
                >
                  {callStatus === "answered"
                    ? "Waiting for speech..."
                    : "Transcription will appear when call is answered"}
                </div>
              ) : (
                <div>
                  {transcriptions.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        marginBottom: "12px",
                        padding: "12px",
                        backgroundColor:
                          item.speaker === "browser" ? "#e3f2fd" : "#f3e5f5",
                        borderRadius: "8px",
                        borderLeft: `4px solid ${
                          item.speaker === "browser" ? "#2196f3" : "#9c27b0"
                        }`,
                        opacity: item.isFinal ? 1 : 0.7,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "5px",
                        }}
                      >
                        <strong>
                          {item.speaker === "browser"
                            ? "🎤 You"
                            : "📞 Phone User"}
                        </strong>
                        <span style={{ fontSize: "12px", color: "#666" }}>
                          {new Date(item.timestamp).toLocaleTimeString()}
                          {!item.isFinal && (
                            <span
                              style={{
                                marginLeft: "5px",
                                fontStyle: "italic",
                                color: "#999",
                              }}
                            >
                              (partial...)
                            </span>
                          )}
                        </span>
                      </div>
                      <p style={{ margin: 0 }}>{item.transcript}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            style={{
              padding: "12px 24px",
              width: "100%",
              fontSize: "16px",
              backgroundColor: "#d32f2f",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            ❌ End Call
          </button>
        </div>
      )}
    </div>
  );
}

export default VonageCallComponent;
