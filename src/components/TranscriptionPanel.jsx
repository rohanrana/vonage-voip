import React, { useRef, useEffect } from "react";

const TranscriptionPanel = ({
  transcriptions,
  isConnected,
  isMicrophoneActive,
  toggleMute,
  isMuted,
}) => {
  const transcriptionEndRef = useRef(null);

  useEffect(() => {
    transcriptionEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptions]);

  return (
    <div
      className="card border-0 shadow-lg"
      style={{
        width: "450px",
        height: "700px",
        borderRadius: "24px",
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(20px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="card-body d-flex flex-column p-0"
        style={{ height: "100%" }}
      >
        {/* Header */}
        <div
          className="p-4"
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: "24px 24px 0 0",
          }}
        >
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-3">
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i className="bi bi-chat-dots-fill text-white fs-4"></i>
              </div>
              <div>
                <h5 className="text-white fw-bold mb-0">Live Transcription</h5>
                <small className="text-white opacity-75">
                  Real-time conversation
                </small>
              </div>
            </div>
            <div className="d-flex gap-2">
              <span
                className="badge"
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              >
                {transcriptions.length}
              </span>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: isConnected ? "#4caf50" : "#f44336",
                  boxShadow: `0 0 12px ${isConnected ? "#4caf50" : "#f44336"}`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div
          className="flex-grow-1 overflow-auto p-4"
          style={{ background: "#f8f9fa" }}
        >
          {transcriptions.length === 0 ? (
            <div className="h-100 d-flex flex-column align-items-center justify-content-center text-center">
              <div
                style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "24px",
                  opacity: 0.1,
                }}
              >
                <i
                  className="bi bi-mic-fill text-white"
                  style={{ fontSize: "48px" }}
                ></i>
              </div>
              <h6 className="text-muted mb-2">Waiting for conversation</h6>
              <p className="text-muted small">
                Start speaking to see transcriptions
              </p>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {transcriptions.map((t, index) => {
                const isPhone = t.speaker === "phone";
                const isFinal = t.isFinal;

                return (
                  <div
                    key={index}
                    className={`d-flex ${isPhone ? "" : "flex-row-reverse"}`}
                    style={{
                      animation: !isFinal
                        ? "pulse-subtle 1. 5s ease-in-out infinite"
                        : "none",
                    }}
                  >
                    <div
                      className="d-flex flex-column"
                      style={{ maxWidth: "75%" }}
                    >
                      {/* Speaker Badge */}
                      <div
                        className={`mb-2 d-flex align-items-center gap-2 ${
                          isPhone ? "" : "flex-row-reverse"
                        }`}
                      >
                        <span
                          className="badge"
                          style={{
                            background: isPhone
                              ? "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
                              : "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            fontSize: "11px",
                            fontWeight: "600",
                          }}
                        >
                          {isPhone ? "📞 Phone" : "💻 You"}
                        </span>

                        {/* Status Indicator */}
                        {!isFinal && (
                          <div
                            className="d-flex align-items-center gap-1"
                            style={{
                              fontSize: "10px",
                              color: "#999",
                            }}
                          >
                            <div
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: "#ffa726",
                                animation: "blink 1s ease-in-out infinite",
                              }}
                            />
                            <span>Processing...</span>
                          </div>
                        )}
                      </div>

                      {/* Message Bubble */}
                      <div
                        className="p-3 shadow-sm position-relative"
                        style={{
                          background: isPhone
                            ? isFinal
                              ? "white"
                              : "rgba(255, 255, 255, 0.7)"
                            : isFinal
                            ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                            : "linear-gradient(135deg, rgba(102, 126, 234, 0.7) 0%, rgba(118, 75, 162, 0.7) 100%)",
                          color: isPhone ? "#1a1a2e" : "white",
                          borderRadius: isPhone
                            ? "8px 16px 16px 16px"
                            : "16px 8px 16px 16px",
                          fontSize: "15px",
                          lineHeight: "1.5",
                          fontWeight: isFinal ? "500" : "400",
                          opacity: isFinal ? 1 : 0.85,
                          border: !isFinal
                            ? "2px dashed rgba(0,0,0,0.1)"
                            : "none",
                          transition: "all 0.3s ease",
                        }}
                      >
                        {/* Transcript Text */}
                        <div
                          style={{ fontStyle: !isFinal ? "italic" : "normal" }}
                        >
                          {t.transcript}
                        </div>

                        {/* Timestamp & Status Footer */}
                        <div
                          className="mt-2 d-flex align-items-center justify-content-between"
                          style={{ fontSize: "11px", opacity: 0.7 }}
                        >
                          <span>
                            {new Date(t.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>

                          {/* Final/Interim Indicator */}
                          <div className="d-flex align-items-center gap-1">
                            {isFinal ? (
                              <>
                                <i
                                  className="bi bi-check-all"
                                  style={{ fontSize: "14px" }}
                                ></i>
                                <span style={{ fontSize: "10px" }}>Done</span>
                              </>
                            ) : (
                              <>
                                <div
                                  className="spinner-border"
                                  style={{
                                    width: "10px",
                                    height: "10px",
                                    borderWidth: "2px",
                                  }}
                                  role="status"
                                >
                                  <span className="visually-hidden">
                                    Loading...
                                  </span>
                                </div>
                                <span style={{ fontSize: "10px" }}>
                                  Listening...{" "}
                                  {/* {isMuted ? "(muted)" : "(active)"} */}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={transcriptionEndRef} />
            </div>
          )}
        </div>

        {/* Footer Status Bar */}
        <div
          className="p-3 border-top"
          style={{ background: "white", borderRadius: "0 0 24px 24px" }}
        >
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: isMicrophoneActive
                    ? "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)"
                    : "#e0e0e0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i
                  className={`bi ${
                    isMicrophoneActive ? "bi-mic-fill" : "bi-mic-mute-fill"
                  } text-white`}
                  style={{ fontSize: "14px" }}
                ></i>
              </div>
              <span className="small text-muted">
                {isMicrophoneActive ? "Microphone active" : "Microphone muted"}
              </span>
            </div>
            <span className="small text-muted">
              <i
                className={`bi ${isConnected ? "bi-wifi" : "bi-wifi-off"} me-1`}
              ></i>
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      {/* Add custom animation styles */}
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.02);
          }
        }
      `}</style>
    </div>
  );
};

export default TranscriptionPanel;
