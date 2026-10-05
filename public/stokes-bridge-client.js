(() => {
  const nativeFetch = window.fetch.bind(window);
  const bridgeEndpoint = 'http://127.0.0.1:3847/api/reporte-stokes';

  window.fetch = (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    const resolved = new URL(rawUrl, window.location.origin);
    if (resolved.origin === window.location.origin && resolved.pathname === '/api/reporte-stokes') {
      return nativeFetch(bridgeEndpoint, init);
    }
    return nativeFetch(input, init);
  };
})();
