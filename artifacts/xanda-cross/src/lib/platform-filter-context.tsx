import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

type PlatformFilterContextType = {
  activePlatform: string | null;
  setActivePlatform: (p: string | null) => void;
};

const PlatformFilterContext = createContext<PlatformFilterContextType>({
  activePlatform: null,
  setActivePlatform: () => {},
});

export function PlatformFilterProvider({ children }: { children: ReactNode }) {
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  return (
    <PlatformFilterContext.Provider value={{ activePlatform, setActivePlatform }}>
      {children}
    </PlatformFilterContext.Provider>
  );
}

export function usePlatformFilter() {
  return useContext(PlatformFilterContext);
}
