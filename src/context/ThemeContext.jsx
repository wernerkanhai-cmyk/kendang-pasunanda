import { createContext, useContext, useEffect, useState } from 'react';
import { SKINS, SKIN_IDS, DEFAULT_SKIN, ALL_TOKEN_KEYS, getSkin } from './skins';

// Skin/thema-systeem. De beschikbare skins en hun palet-waarden staan in
// ./skins.js — een skin toevoegen doe je daar (één object), niet hier.
const ThemeContext = createContext({
  theme: DEFAULT_SKIN,
  skins: SKINS,
  setTheme: () => {},
  toggleTheme: () => {},
});

const STORAGE_KEY = 'kendangTheme';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return SKIN_IDS.includes(saved) ? saved : DEFAULT_SKIN;
    } catch {
      return DEFAULT_SKIN;
    }
  });

  useEffect(() => {
    const skin = getSkin(theme);
    const body = document.body;
    // Wis eerst alle bekende tokens, pas dan de actieve skin toe — zo valt een
    // skin die een sleutel weglaat netjes terug op de :root-default.
    ALL_TOKEN_KEYS.forEach((key) => body.style.removeProperty(key));
    for (const [key, val] of Object.entries(skin.tokens)) {
      body.style.setProperty(key, val);
    }
    // Marker-class voor eventuele CSS-hooks.
    body.classList.remove(...SKIN_IDS.map((id) => `theme-${id}`));
    body.classList.add(`theme-${skin.id}`);
    try {
      localStorage.setItem(STORAGE_KEY, skin.id);
    } catch {
      /* localStorage niet beschikbaar — negeren */
    }
  }, [theme]);

  // Doorloopt de skins cyclisch — handig voor een snelle toggle/sneltoets.
  const toggleTheme = () =>
    setTheme((cur) => SKIN_IDS[(SKIN_IDS.indexOf(cur) + 1) % SKIN_IDS.length]);

  return (
    <ThemeContext.Provider value={{ theme, skins: SKINS, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
