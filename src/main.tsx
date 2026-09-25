import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-600.css";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/geist/latin-400.css";
import "@fontsource/geist/latin-500.css";
import "@fontsource/geist/latin-600.css";
import PublicApp from "./PublicApp";
const LabApp = lazy(() => import("./LabApp"));
const publicSite = import.meta.env.VITE_PUBLIC_SITE === "1";
const OperatorApp = publicSite ? null : lazy(() => import("./App"));
import "./style.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {OperatorApp && location.pathname === "/console" ? (
      <Suspense
        fallback={
          <div className="console-loading">Opening the operator console…</div>
        }
      >
        <OperatorApp />
      </Suspense>
    ) : location.pathname === "/" ? (
      <PublicApp />
    ) : (
      <Suspense
        fallback={<div className="console-loading">Opening the lab…</div>}
      >
        <LabApp />
      </Suspense>
    )}
  </React.StrictMode>,
);
