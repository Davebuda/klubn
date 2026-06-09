export const registerServiceWorker = async () => {
  // Avoid intercepting dev traffic (HMR websockets) with the service worker.
  if (import.meta.env.DEV) {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    return null;
  }

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      return registration;
    } catch (error) {
      console.warn('Service worker registration failed', error);
    }
  }
  return null;
};

export const setupInstallPrompt = () => {
  // placeholder for custom install prompt logic
};
