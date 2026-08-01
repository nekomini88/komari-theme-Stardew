// Stardew-2 Service Worker override.
// Purpose: prevent Komari's built-in Service Worker from precaching stale theme assets.
(function() {
  try {
    var originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = function() {
      return Promise.reject(new Error('[stardew-2] Service Worker registration blocked by theme'));
    };
  } catch (e) {
    // If serviceWorker is not available, no action needed.
  }
})();
