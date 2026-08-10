import { useEffect, useState } from 'react';

// Mirrors the toggle on the other sites, including the storage key, so a
// choice made here reads the same way if the theme is ever shared across
// the family. index.html sets the initial value before first paint.
const STORAGE_KEY = 'harithkavish-theme';

type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function ThemeToggle(): JSX.Element {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Switch to ${next} mode`}
      onClick={() => {
        localStorage.setItem(STORAGE_KEY, next);
        setTheme(next);
      }}
    >
      {next === 'dark' ? 'Dark mode' : 'Light mode'}
    </button>
  );
}
