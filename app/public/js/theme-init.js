// Applies the saved (or system) colour theme before the page paints, to avoid a flash.
// Loaded as a plain blocking script in <head>. The switch itself is js/theme-toggle.js.
(function () {
  var t = null;
  try { t = localStorage.getItem('theme'); } catch (e) { /* storage blocked: follow the system */ }
  if (t !== 'dark' && t !== 'light') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
})();
