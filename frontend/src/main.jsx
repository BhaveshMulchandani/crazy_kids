import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import "./index.css";
import App from "./App.jsx";

const queryClient = new QueryClient();

// HashRouter everywhere (not just the packaged Electron file:// build this
// used to be limited to): the route lives after "#", so the browser's
// actual HTTP request on every load/reload is always for "/" — it never
// asks the server for "/admin/reports" directly. That's what makes reloads
// work with zero server-side SPA-rewrite config, on every host this build
// ships to (Electron's file://, Nginx, Vercel, anything). With
// BrowserRouter, reloading a nested route (e.g. /admin/reports) requests
// that literal path from the server; combined with vite.config.js's
// relative `base: "./"` (required for the file:// build, where an absolute
// "/" base would resolve to the filesystem root), the page's relative
// asset URLs then resolve against "/admin/" instead of "/" and 404 — a
// static host's HTML fallback for that 404 is what actually produced the
// "Expected a JavaScript module but server responded with text/html"
// error, since the fallback page is HTML, not the missing JS module.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HashRouter>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </HashRouter>
  </StrictMode>
);