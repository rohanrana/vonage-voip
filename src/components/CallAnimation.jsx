import React from "react";

const CallAnimation = ({ phoneNumber, country, isMicrophoneActive }) => {
  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{
        width: "400px",
        height: "700px",
        borderRadius: "24px",
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(20px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Animated Ripples */}
      <div
        style={{
          position: "absolute",
          width: "200px",
          height: "200px",
          borderRadius: "50%",
          border: "4px solid #667eea",
          opacity: 0.6,
          animation: "ripple 3s ease-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "200px",
          height: "200px",
          borderRadius: "50%",
          border: "4px solid #764ba2",
          opacity: 0.4,
          animation: "ripple 3s ease-out infinite 1s",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "200px",
          height: "200px",
          borderRadius: "50%",
          border: "4px solid #f093fb",
          opacity: 0.2,
          animation: "ripple 3s ease-out infinite 2s",
        }}
      />

      {/* Center Icon */}
      <div className="text-center" style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            animation: "pulse 2s ease-in-out infinite",
          }}
        >
          <i
            className="bi bi-telephone-fill text-white"
            style={{ fontSize: "48px" }}
          ></i>
        </div>

        <h4
          style={{
            fontSize: "24px",
            fontWeight: "600",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Call in Progress
        </h4>

        <p className="text-muted mt-2">
          {country.dial_code} {phoneNumber}
        </p>

        {/* Call Stats */}
        <div className="mt-5">
          <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: "#4caf50",
                animation: "blink 1.5s ease-in-out infinite",
              }}
            />
            <span className="text-muted small">Connected</span>
          </div>

          <div className="d-flex justify-content-center gap-4 mt-4">
            <div className="text-center">
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "12px",
                  background: isMicrophoneActive
                    ? "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)"
                    : "#e0e0e0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 8px",
                }}
              >
                <i
                  className={`bi ${
                    isMicrophoneActive ? "bi-mic-fill" : "bi-mic-mute-fill"
                  } text-white fs-5`}
                ></i>
              </div>
              <small className="text-muted">Mic</small>
            </div>

            <div className="text-center">
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "12px",
                  background:
                    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 8px",
                }}
              >
                <i className="bi bi-soundwave text-white fs-5"></i>
              </div>
              <small className="text-muted">Audio</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallAnimation;
