/*
 * The single moment in time that all 5 pages observe from.
 *
 * This is the ONE value that must be identical across every page's
 * <script> config for the "shared stars" idea to be real astronomy
 * rather than a coincidence: the sky each location sees depends on
 * latitude (which declinations ever rise) AND on this exact instant
 * (which right ascensions currently face away from the sun).
 *
 * Format: ISO 8601 in UTC, e.g. "2026-09-11T20:00:00Z"
 * Change this to whatever date/time matters to you -- a birthday,
 * an anniversary, the night you all agreed to look up at once, etc.
 */
const OBSERVATION_TIME_UTC = "2026-09-11T20:00:00Z";
