// Capacitor Browser plugin is registered on native platforms after cap sync.
document.addEventListener('click', async (event) => {
  const anchor = event.target.closest('a[href]');
  if (!anchor || !/^https?:/i.test(anchor.href)) return;
  // Only intercept links that were intended to open outside the web app.
  if (anchor.target !== '_blank') return;
  if (!window.Capacitor?.isNativePlatform?.()) return;
  const open = window.Capacitor?.Plugins?.Browser?.open;
  if (typeof open !== 'function') return;
  event.preventDefault();
  try {
    await open({ url: anchor.href });
  } catch (e) {
    console.error('Could not open external page', e);
  }
});
