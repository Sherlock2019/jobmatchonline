export interface Coords { lat: number; lng: number }

/** Ask the browser for the user's current location. Rejects if denied/unsupported. */
export function getBrowserLocation(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject(new Error('Location is not available on this device')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'Location permission denied' : 'Could not get your location')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  });
}
