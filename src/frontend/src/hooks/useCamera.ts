import { useRef, useState, useCallback, useEffect, useMemo } from "react";

export type FrameType = "none" | "heart" | "ribbon" | "gold";

const FRAME_CONFIGS: Record<FrameType, { label: string; draw: (ctx: CanvasRenderingContext2D, size: number) => void }> = {
  none: {
    label: "フレームなし",
    draw: () => {},
  },
  heart: {
    label: "ハート&花",
    draw: (ctx, size) => {
      ctx.strokeStyle = "#e91e63";
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, size - 8, size - 8);
      // ハートを四隅に描画
      const hearts = [[20, 20], [size - 40, 20], [20, size - 40], [size - 40, size - 40]];
      ctx.fillStyle = "#e91e63";
      ctx.font = "24px serif";
      hearts.forEach(([x, y]) => ctx.fillText("❤", x, y + 20));
      // 花を上下に描画
      ctx.font = "18px serif";
      ctx.fillText("🌸", size / 2 - 10, 22);
      ctx.fillText("🌸", size / 2 - 10, size - 8);
    },
  },
  ribbon: {
    label: "リボン",
    draw: (ctx, size) => {
      ctx.strokeStyle = "#ff80ab";
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, size - 10, size - 10);
      ctx.font = "28px serif";
      ctx.fillText("🎀", size / 2 - 14, 30);
      ctx.fillText("🎀", size / 2 - 14, size - 6);
    },
  },
  gold: {
    label: "ゴールド",
    draw: (ctx, size) => {
      const gradient = ctx.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, "#ffd700");
      gradient.addColorStop(0.5, "#ffec8b");
      gradient.addColorStop(1, "#ffd700");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 12;
      ctx.strokeRect(6, 6, size - 12, size - 12);
      ctx.lineWidth = 4;
      ctx.strokeRect(16, 16, size - 32, size - 32);
    },
  },
};

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<FrameType>("none");
  const [error, setError] = useState<string | null>(null);

  const isSupported = typeof navigator !== "undefined"
    && !!navigator.mediaDevices
    && !!navigator.mediaDevices.getUserMedia;

  const startCamera = useCallback(async () => {
    setError(null);

    if (!isSupported) {
      setError("このブラウザではカメラを利用できません。HTTPSでアクセスしてください。");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 400, height: 400 },
      });
      streamRef.current = stream;
      setIsActive(true);
    } catch (e) {
      const err = e as DOMException;
      if (err.name === "NotAllowedError") {
        setError("カメラの使用が許可されていません。ブラウザの設定からカメラを許可してください。");
      } else if (err.name === "NotFoundError") {
        setError("カメラが見つかりません。カメラが接続されているか確認してください。");
      } else {
        setError("カメラの起動に失敗しました。カメラの許可を確認してください。");
      }
    }
  }, [isSupported]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsActive(false);
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    if (video.readyState < video.HAVE_CURRENT_DATA) return null;

    const size = 400;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // 自撮り（ミラーリング）
    ctx.save();
    ctx.translate(size, 0);
    ctx.scale(-1, 1);

    // 動画を正方形にクロップ
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cropSize = Math.min(vw, vh);
    const sx = (vw - cropSize) / 2;
    const sy = (vh - cropSize) / 2;
    ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, size, size);
    ctx.restore();

    // フレーム描画
    FRAME_CONFIGS[selectedFrame].draw(ctx, size);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
    return dataUrl;
  }, [selectedFrame, stopCamera]);

  const retake = useCallback(() => {
    setCapturedImage(null);
    setError(null);
    startCamera();
  }, [startCamera]);

  // isActive変化後にvideo要素へストリームを接続
  useEffect(() => {
    if (isActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isActive]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const frameOptions = useMemo(
    () =>
      Object.entries(FRAME_CONFIGS).map(([key, config]) => ({
        type: key as FrameType,
        label: config.label,
      })),
    [],
  );

  return {
    videoRef,
    canvasRef,
    isActive,
    capturedImage,
    selectedFrame,
    setSelectedFrame,
    startCamera,
    stopCamera,
    capture,
    retake,
    error,
    isSupported,
    frameOptions,
  };
}
