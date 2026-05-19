import React, { createContext, useContext } from "react";
import { LIGHT, DARK } from "../constants";

type Theme = "clik" | "clik_dark";

interface AppContextType {
  t: typeof LIGHT;
  isDark: boolean;
  tema: Theme;
  setTema: (tema: Theme) => void;
  claveMaestra: string;
}

export const Ctx = createContext<AppContextType | null>(null);

export const useApp = () => {
  const context = useContext(Ctx);
  if (!context) {
    throw new Error("useApp must be used within a Ctx.Provider");
  }
  return context;
};
