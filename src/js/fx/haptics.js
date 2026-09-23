/** Vibrate if the device can (Android); a silent no-op elsewhere (iOS has no vibrate). */
export function buzz(p){ if(!navigator.vibrate) return; try{ navigator.vibrate(p); }catch(e){} }
