// Promise wrapper around the browser Geolocation API with readable errors.
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(new Error('Location requires a secure (https) connection.'));
      return;
    }
    if (!('geolocation' in navigator)) {
      reject(new Error('This browser does not support location services.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Location permission denied. Allow location access in your browser settings and try again.'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Location unavailable. Turn on GPS / location services and try again.'));
            break;
          case error.TIMEOUT:
            reject(new Error('Timed out getting your location. Move near a window or outdoors and try again.'));
            break;
          default:
            reject(new Error('Could not get your location.'));
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

export function formatDistance(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}
