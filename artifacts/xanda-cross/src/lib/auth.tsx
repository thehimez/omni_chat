import { useClerk } from "@clerk/react";

export function useAppAuth() {
  const { signOut } = useClerk();
  return {
    signOut: () => signOut({ redirectUrl: "/" }),
  };
}
