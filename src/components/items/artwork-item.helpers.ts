// Small helper utilities for artwork-item. Kept separate from the
// TSX component to avoid any module-resolution or JSX-related typing
// issues when importing helpers from tests.

export function formatArtist(name?: string) {
  if (!name) return undefined;
  const trimmed = name.trim();
  if (trimmed.includes(",")) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[0];
  const rest = parts.slice(1).join(" ");
  return `${last}, ${rest}`;
}
