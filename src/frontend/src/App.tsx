import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { NotFoundPage } from "./pages/NotFoundPage";

const SetupPage = lazy(() => import("./pages/host/SetupPage").then((m) => ({ default: m.SetupPage })));
const HostPage = lazy(() => import("./pages/host/HostPage").then((m) => ({ default: m.HostPage })));
const DisplayPage = lazy(() => import("./pages/host/DisplayPage").then((m) => ({ default: m.DisplayPage })));
const JoinPage = lazy(() => import("./pages/participant/JoinPage").then((m) => ({ default: m.JoinPage })));
const PlayPage = lazy(() => import("./pages/participant/PlayPage").then((m) => ({ default: m.PlayPage })));

function LoadingFallback() {
  return (
    <div className="h-[100dvh] flex items-center justify-center bg-gradient-to-b from-blush to-white">
      <p className="text-lg text-gray-500">読み込み中…</p>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/host/setup" element={<SetupPage />} />
          <Route path="/host/:roomCode/screen" element={<DisplayPage />} />
          <Route path="/host/:roomCode" element={<HostPage />} />
          <Route path="/play" element={<JoinPage />} />
          <Route path="/play/:roomCode" element={<PlayPage />} />
          <Route path="/" element={<Navigate to="/play" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
