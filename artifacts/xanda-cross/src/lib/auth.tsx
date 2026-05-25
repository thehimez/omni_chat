import React from "react";

type AuthContextType = {
  signOut: () => void;
};

export const AuthContext = React.createContext<AuthContextType>({
  signOut: () => window.location.reload(),
});

export function useAppAuth(): AuthContextType {
  return React.useContext(AuthContext);
}
