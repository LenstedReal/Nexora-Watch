import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";
import { inApp } from "@/lib/native";
import { startUpdateWatch } from "@/lib/update";
import { startErrorReporting } from "@/lib/errors";
import ErrorBoundary from "@/components/ErrorBoundary";

if (inApp()) document.documentElement.classList.add("in-app");
startUpdateWatch();
startErrorReporting();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
