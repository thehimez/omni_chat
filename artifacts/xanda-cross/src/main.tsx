import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function AppWithAuth() {
  const { getToken } = useAuth();
  setAuthTokenGetter(async () => {
    const token = await getToken();
    return token ?? "";
  });
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={publishableKey}>
    <AppWithAuth />
  </ClerkProvider>
);
