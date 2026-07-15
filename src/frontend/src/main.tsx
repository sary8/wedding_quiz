import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
// フォント読み込みについて:
// - 装飾書体（Great Vibes / Cormorant Infant）は index.html で preload +
//   インライン @font-face 宣言（latin サブセットを public/fonts/ からセルフホスト）
// - 日本語は各OSのシステムフォント（Android=Noto Sans, iOS=ヒラギノ, Windows=游ゴシック）。
//   Web フォント化すると @font-face 360宣言 / CSS +300KB になり FCP を悪化させる
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
