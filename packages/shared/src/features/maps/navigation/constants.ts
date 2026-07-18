export const NAV_ZOOM = 19.1; // close street-level navigation zoom
export const NAV_PITCH = 50; // tilted Navigation Mode
export const NAV_ALTITUDE_M = 180; // low Apple Maps altitude, ignored by Google Maps
// Screen-anchor for the driver marker during Navigation Mode, as a fraction
// down the *visible* map area (above the bottom sheet). 0.5 = centered, 1.0 =
// pinned to the bottom edge. ~0.78 matches Grab / Google Maps navigation feel:
// the driver sits low on the screen while the road ahead fills the upper view.
export const NAV_DRIVER_SCREEN_ANCHOR = 0.85;
export const NAV_CAMERA_ANIM_MS = 600; // animateCamera duration per update
export const OFF_ROUTE_M = 50; // deviation that forces a route refresh
export const OFF_ROUTE_CONFIRMATION_COUNT = 2; // consecutive confirmations before rerouting
export const HEADING_MISMATCH_DEG = 100; // route-vs-GPS course mismatch that suggests wrong direction
export const REROUTE_MIN_MOVE_M = 60; // distance gate for routine refresh
export const REROUTE_MIN_INTERVAL_MS = 25_000; // time gate for routine refresh
export const HEADING_SPEED_THRESHOLD_MS = 1.5; // above this, trust GPS course over magnetometer
export const HEADING_GPS_COURSE_DISABLE_SPEED_MS = 1.0; // below this, fall back to compass after GPS course was selected
export const POSITION_HISTORY_MIN_MOVE_M = 8; // minimum movement for position-history bearing fallback
export const POSITION_HISTORY_MAX_AGE_MS = 5_000; // max age of position samples in history buffer
