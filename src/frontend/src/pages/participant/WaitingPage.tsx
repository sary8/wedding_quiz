type Props = {
  message?: string;
};

export function WaitingPage({ message = "まもなく開始します..." }: Props) {
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #667eea, #764ba2)", color: "#fff" }}>
      <div aria-hidden="true" className="pulse-icon" style={{ fontSize: 48, marginBottom: 24 }}>💒</div>
      <p style={{ fontSize: 20 }}>{message}</p>
      <style>{`
        .pulse-icon { animation: pulse 2s infinite; }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pulse-icon { animation: none; }
        }
      `}</style>
    </div>
  );
}
