import { Moon, Sun } from 'lucide-react';
import type { Theme } from '../useTheme';

export default function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      onClick={onToggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted
                 hover:text-ink transition"
    >
      {theme === 'dark' ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
    </button>
  );
}
