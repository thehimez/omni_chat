import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";

// Demo auth token for development when Clerk is not configured
setAuthTokenGetter(() => "demo_token");

createRoot(document.getElementById("root")!).render(<App />);
