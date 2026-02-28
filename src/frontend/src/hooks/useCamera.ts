import { useRef, useState, useCallback, useEffect, useMemo } from "react";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
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
      // video要素へストリームを接続
      requestAnimationFrame(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play()?.catch(() => {});
        }
      });
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

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
    return dataUrl;
  }, [stopCamera]);

  const retake = useCallback(() => {
    setCapturedImage(null);
    setError(null);
    startCamera();
  }, [startCamera]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return useMemo(() => ({
    videoRef,
    canvasRef,
    isActive,
    capturedImage,
    startCamera,
    stopCamera,
    capture,
    retake,
    error,
    isSupported,
  }), [isActive, capturedImage, startCamera, stopCamera, capture, retake, error, isSupported]);
}
