export function currentPath() {
  return (location.hash.replace(/^#/, '') || '/').replace(/\/+$/, '') || '/';
}
export function navigate(path) {
  location.hash = '#' + path;
}
