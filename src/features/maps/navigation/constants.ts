export const NAV_ZOOM = 17.5;            // street-level zoom; Grab/Google default
export const NAV_PITCH = 45;             // 45° tilt in Navigation Mode
export const NAV_CAMERA_ANIM_MS = 600;   // animateCamera duration per update
export const NAV_RECENTER_IDLE_MS = 8_000; // auto-resume follow after manual pan
export const OFF_ROUTE_M = 50;           // deviation that forces a route refresh
export const REROUTE_MIN_MOVE_M = 60;    // distance gate for routine refresh
export const REROUTE_MIN_INTERVAL_MS = 25_000; // time gate for routine refresh
export const HEADING_SPEED_THRESHOLD_MS = 1.5; // above this, trust GPS course over magnetometer
