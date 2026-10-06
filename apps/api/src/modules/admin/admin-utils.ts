export function escapeRegex(q: string) {
  return q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
