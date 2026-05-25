import React from "react";
import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { AuthContext } from "./lib/auth";
import App from "./App";
import "./index.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

if (!publishableKey) {
  // Dev mode — no Clerk. Use a fixed token; backend demo mode accepts any Bearer value.
  setAuthTokenGetter(() => "dev-bypass-xanda");

  createRoot(document.getElementById("root")!).render(
    <AuthContext.Provider value={{ signOut: () => window.location.reload() }}>
      <App devMode={true} />
    </AuthContext.Provider>
  );
} else {
  // Clerk mode — dynamically import so Clerk is never even parsed in dev mode.
  import("@clerk/clerk-react").then(({ ClerkProvider, useAuth, useClerk }) => {
    function ClerkAuthBridge({ children }: { children: React.ReactNode }) {
      const { getToken } = useAuth();
      const { signOut } = useClerk();

      React.useEffect(() => {
        setAuthTokenGetter(async () => {
          const token = await getToken();
          return token ?? "";
        });
      }, [getToken]);

      return (
        <AuthContext.Provider value={{ signOut: () => signOut() }}>
          {children}
        </AuthContext.Provider>
      );
    }

    createRoot(document.getElementById("root")!).render(
      <ClerkProvider publishableKey={publishableKey}>
        <ClerkAuthBridge>
          <App devMode={false} />
        </ClerkAuthBridge>
      </ClerkProvider>
    );
  });
}
