import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { I18nProvider } from "@/i18n";
import Home from "@/pages/Home";
import RoomPage from "@/pages/Room";

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:code" element={<RoomPage />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
      <Toaster theme="dark" position="top-center" toastOptions={{ style: { background: "#202033", border: "1px solid #2e2e3a", color: "#f9fafb" } }} />
    </I18nProvider>
  );
}
