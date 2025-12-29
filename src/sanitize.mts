export function sanitize(str: string) {
  return str.replace(/\n/g, "").replace(/"/g, '\\"');
}
