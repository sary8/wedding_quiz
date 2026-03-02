import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { normalizeRoomCode } from "../../utils/normalizeInput";

export function JoinPage() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const code = normalizeRoomCode(roomCode);

    if (code.length !== 6) {
      setError("6桁のルームコードを入力してください");
      return;
    }

    setError("");
    navigate(`/play/${code}`);
  }

  function handleChange(value: string) {
    setRoomCode(normalizeRoomCode(value).slice(0, 6));
    if (error) setError("");
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-blush px-6">
      {/* タイトル */}
      <header className="text-center mb-8">
        <h1 className="font-script text-6xl text-primary mb-1 [text-wrap:balance]">Wedding Quiz</h1>
        <div className="flex items-center gap-3 justify-center my-3">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-accent/50" />
          <span className="inline-block w-2 h-2 rotate-45 bg-accent" aria-hidden="true" />
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-accent/50" />
        </div>
        <p className="font-serif-wedding text-rose-text/70 tracking-widest text-sm uppercase">Celebration Game</p>
      </header>

      {/* カード */}
      <div className="w-full max-w-xs bg-white rounded-2xl shadow-[0_4px_32px_rgba(219,39,119,0.12)] border border-primary/10 p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            type="text"
            value={roomCode}
            onChange={(e) => handleChange(e.target.value)}
            onCompositionEnd={(e) => handleChange((e.target as HTMLInputElement).value)}
            placeholder="XXXXXX"
            maxLength={6}
            label="ルームコード（6桁）"
            error={error}
            className="text-3xl tracking-widest text-center"
            autoComplete="off"
            inputMode="numeric"
            spellCheck={false}
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

      {/* フッター装飾 */}
      <p className="mt-8 text-primary/60 text-xs">本日はご参加いただきありがとうございます</p>
    </div>
  );
}
