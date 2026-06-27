import { createContext, useContext, useEffect, useState } from 'react';

// Skin/thema: 'modern' (grafiet + blauw/goud) of 'classic' (witte regels, zwarte
// anak / rode indung — het v1.0-palet). Alleen het PALET wisselt; de structuur
// (SVG-iconen, metallic balken, layout) blijft in beide skins gelijk.
const ThemeContext = createContext({ theme: 'modern', setTheme: () => {}, toggleTheme: () => {} });

const STORAGE_KEY = 'kendangTheme';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'classic' || saved === 'modern' ? saved : 'modern';
    } catch {
      return 'modern';
    }
  });

  useEffect(() => {
    document.body.classList.remove('theme-classic', 'theme-modern');
    document.body.classList.add(`theme-${theme}`);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* localStorage niet beschikbaar — negeren */
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'modern' ? 'classic' : 'modern'));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
