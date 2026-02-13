import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input } from "../../components/ui";

export function JoinPage() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();

    if (code.length !== 6) {
      setError("6文字のルームコードを入力してください");
      return;
    }

    setError("");
    navigate(`/play/${code}`);
  }

  function handleChange(value: string) {
    setRoomCode(value.toUpperCase().slice(0, 6));
    if (error) setError("");
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary to-primary-dark px-6">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Wedding Quiz</h1>
        <p className="text-white/80 text-lg">ルームコードを入力して参加</p>
      </header>

      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-4">
        <Input
          type="text"
          value={roomCode}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="ルームコード"
          maxLength={6}
          label="ルームコード（6文字）"
          error={error}
          className="text-3xl tracking-widest uppercase"
          aria-label="ルームコード（6文字の英数字）"
          autoComplete="off"
          autoFocus
        />

        <Button
          type="submit"
          variant="accent"
          size="lg"
          fullWidth
          disabled={roomCode.length !== 6}
        >
          参加する
        </Button>
      </form>
    </div>
  );
}
