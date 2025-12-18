import React from "react";

const DecorativePanel = () => {
  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{
        width: "500px",
        height: "700px",
        borderRadius: "24px",
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(20px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Animated Background Circles */}
      <div
        style={{
          position: "absolute",
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          opacity: 0.1,
          top: "-100px",
          right: "-100px",
          animation: "float 6s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "200px",
          height: "200px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
          opacity: 0.1,
          bottom: "-50px",
          left: "-50px",
          animation: "float 8s ease-in-out infinite reverse",
        }}
      />

      {/* Content */}
      <div
        className="text-center p-5"
        style={{ position: "relative", zIndex: 1 }}
      >
        {/* Calligraphy Text */}
        <h1
          style={{
            fontSize: "72px",
            fontWeight: "700",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            marginBottom: "24px",
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          VoIP
        </h1>

        <p
          style={{
            fontSize: "24px",
            color: "#667eea",
            fontWeight: "300",
            marginBottom: "48px",
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          Make calls anywhere
        </p>

        {/* Feature Icons */}
        <div className="d-flex justify-content-center gap-4 mb-4">
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "bounce 2s ease-in-out infinite",
            }}
          >
            <i className="bi bi-telephone-fill text-white fs-2"></i>
          </div>
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "bounce 2s ease-in-out infinite 0.2s",
            }}
          >
            <i className="bi bi-chat-dots-fill text-white fs-2"></i>
          </div>
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "bounce 2s ease-in-out infinite 0.4s",
            }}
          >
            <i className="bi bi-mic-fill text-white fs-2"></i>
          </div>
        </div>

        {/* Stats */}
        <div className="row mt-5">
          <div className="col-4">
            <h3
              style={{
                fontSize: "32px",
                fontWeight: "700",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              HD
            </h3>
            <p className="text-muted small">Quality</p>
          </div>
          <div className="col-4">
            <h3
              style={{
                fontSize: "32px",
                fontWeight: "700",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              24/7
            </h3>
            <p className="text-muted small">Available</p>
          </div>
          <div className="col-4">
            <h3
              style={{
                fontSize: "32px",
                fontWeight: "700",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              AI
            </h3>
            <p className="text-muted small">Powered</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DecorativePanel;
