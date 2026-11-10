const storedTheme = (() => {
  try {
    return localStorage.getItem("agrosen-theme");
  } catch {
    return null;
  }
})();

if (storedTheme === "light" || storedTheme === "dark") {
  document.documentElement.dataset.theme = storedTheme;
}
