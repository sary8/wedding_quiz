import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { NotFoundPage } from "./pages/NotFoundPage";

const SetupPage = lazy(() => import("./pages/host/SetupPage").then((m) => ({ default: m.SetupPage })));
const HostPage = lazy(() => import("./pages/host/HostPage").then((m) => ({ default: m.HostPage })));
const DisplayPage = lazy(() => import("./pages/host/DisplayPage").then((m) => ({ default: m.DisplayPage })));
const JoinPage = lazy(() => import("./pages/participant/JoinPage").then((m) => ({ default: m.JoinPage })));
const PlayPage = lazy(() => import("./pages/participant/PlayPage").then((m) => ({ default: m.PlayPage })));
const PreviewPage = lazy(() => import("./pages/host/PreviewPage").then((m) => ({ default: m.PreviewPage })));
const FinalDemoPage = lazy(() => import("./pages/host/FinalDemoPage").then((m) => ({ default: m.FinalDemoPage })));
const RankingDemoPage = lazy(() => import("./pages/host/RankingDemoPage").then((m) => ({ default: m.RankingDemoPage })));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy").then((m) => ({ default: m.PrivacyPolicy })));

function LoadingFallback() {
  return (
    <div className="h-[100dvh] flex items-center justify-center bg-gradient-to-b from-blush to-white" role="status">
      <p className="text-lg text-gray-600">読み込み中…</p>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-white focus:p-4 focus:text-primary focus:shadow-lg focus:rounded-br-lg"
      >
        メインコンテンツにスキップ
      </a>
      <Suspense fallback={<LoadingFallback />}>
        <main id="main-content">
        <Routes>
          <Route path="/demo/final" element={<FinalDemoPage />} />
          <Route path="/demo/ranking" element={<RankingDemoPage />} />
          <Route path="/host/setup" element={<SetupPage />} />
          <Route path="/host/:quizId/preview" element={<PreviewPage />} />
          <Route path="/host/:roomCode/screen" element={<DisplayPage />} />
          <Route path="/host/:roomCode" element={<HostPage />} />
          <Route path="/play" element={<JoinPage />} />
          <Route path="/play/:roomCode" element={<PlayPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/" element={<Navigate to="/play" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </main>
      </Suspense>
    </BrowserRouter>
  );
}
