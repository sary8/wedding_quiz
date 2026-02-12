type Props = {
  message?: string;
};

export function WaitingPage({ message = "まもなく開始します..." }: Props) {
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #667eea, #764ba2)", color: "#fff" }}>
      <div style={{ fontSize: 48, marginBottom: 24, animation: "pulse 2s infinite" }}>💒</div>
      <p style={{ fontSize: 20 }}>{message}</p>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
