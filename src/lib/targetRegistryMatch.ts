export function isTargetUndraggable(
  targetName: string,
  registry: Array<{ target_name: string }>
): boolean {
  const needle = targetName.toLowerCase().trim();
  if (!needle) return false;
  return registry.some(
    (entry) =>
      entry.target_name.toLowerCase() === needle ||
      needle.includes(entry.target_name.toLowerCase()) ||
      entry.target_name.toLowerCase().includes(needle)
  );
}
