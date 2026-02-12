import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SetupPage } from "./pages/host/SetupPage";
import { HostPage } from "./pages/host/HostPage";
import { JoinPage } from "./pages/participant/JoinPage";
import { PlayPage } from "./pages/participant/PlayPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/host/setup" element={<SetupPage />} />
        <Route path="/host/:roomCode" element={<HostPage />} />
        <Route path="/play" element={<JoinPage />} />
        <Route path="/play/:roomCode" element={<PlayPage />} />
        <Route path="/" element={<Navigate to="/play" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
