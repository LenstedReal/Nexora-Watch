import "@/App.css";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { I18nProvider } from "@/i18n";
import Home from "@/pages/Home";
import RoomPage from "@/pages/Room";
import { ConsentGate } from "@/components/ConsentGate";
import { ChildSafety, Copyright, DeleteData, Kvkk, Privacy, Terms } from "@/pages/Legal";
import { checkForUpdate } from "@/lib/update";

/** Leaving a room (or any page change) is a good moment to move to a newer release, if there is one. */
function UpdateWatcher() {
  const { pathname } = useLocation();
  useEffect(() => { checkForUpdate(); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <UpdateWatcher />
        <ConsentGate>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:code" element={<RoomPage />} />
          <Route path="/gizlilik" element={<Privacy />} />
          <Route path="/kosullar" element={<Terms />} />
          <Route path="/kvkk" element={<Kvkk />} />
          <Route path="/telif" element={<Copyright />} />
          <Route path="/veri-silme" element={<DeleteData />} />
          <Route path="/cocuk-guvenligi" element={<ChildSafety />} />
          <Route path="*" element={<Home />} />
        </Routes>
        </ConsentGate>
      </BrowserRouter>
      <Toaster theme="dark" position="top-center" toastOptions={{ style: { background: "#202033", border: "1px solid #2e2e3a", color: "#f9fafb" } }} />
    </I18nProvider>
  );
}
