"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/lib/theme-context";
import type { ThemeName } from "@/lib/db/schema";
import { setThemePreferenceAction } from "@/app/user-actions";
import { queryKeys } from "@/lib/consts";
import { cn } from "@/lib/utils";

const COLOR_THEMES: Array<{ id: ThemeName; label: string; swatch: string }> = [
{ id: "default", label: "Default", swatch: "oklch(0.76 0.08 72)" },
  { id: "midnight", label: "Midnight", swatch: "oklch(0.35 0.15 258)" },
  { id: "sepia", label: "Sepia", swatch: "oklch(0.45 0.09 55)" },
  { id: "forest", label: "Forest", swatch: "oklch(0.42 0.09 150)" },
];

export function ColorThemePicker({ isAuthed }: { isAuthed: boolean }) {
  const { colorTheme, setColorTheme } = useTheme();
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (theme: ThemeName) => setThemePreferenceAction(theme),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.data });
    },
  });

  function handleSelect(theme: ThemeName) {
    setColorTheme(theme);
    if (isAuthed) {
      saveMutation.mutate(theme);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {COLOR_THEMES.map((option) => {
        const isActive = colorTheme === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => handleSelect(option.id)}
            className="flex flex-col items-center gap-1.5"
            aria-label={`Use ${option.label} theme`}
            aria-pressed={isActive}
          >
            <span
              className={cn(
                "size-8 rounded-full border-2 transition-all",
                isActive ? "border-foreground scale-110" : "border-border",
              )}
              style={{ backgroundColor: option.swatch }}
            />
            <span className="text-xs text-muted-foreground">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}