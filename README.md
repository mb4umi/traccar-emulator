# Traccar Emulator for Raceradar

Replay GPX track points to Raceradar's OSMAND ingest endpoint, with a Leaflet map and request log.

## Start locally

Requires Python 3 and curl (available on macOS). No Python packages are needed.

```sh
python3 server.py --port 8765
```

Open http://127.0.0.1:8765, select a GPX file, enter your tracking URL (`https://raceradar.de/ingest/osmand?id=…`), set seconds per point and click **Start Streaming**. **Stop Streaming** stops playback. **SOS einmal senden** sends exactly one SOS position using the last successful point (or the selected GPX start point before playback). Normal playback never includes an SOS flag.

Use `server.py` instead of a generic static HTTP server: Raceradar does not enable browser CORS, so the local server forwards requests and returns the actual HTTP status and response. It listens only on loopback and forwards only to `https://raceradar.de/ingest/osmand`. Tracker credentials are not saved in the source or request logs. HTTPS certificates are verified by curl.

## Payload and playback

- Sends form fields `lat`, `lon`, `timestamp` (ISO UTC), `accuracy`, `batt`, `valid`, speed in knots and optionally `alarm=sos`. Speed and cumulative distance are calculated from GPX geometry and original time differences. Accuracy, speed and battery can be overridden.
- Additional OSMAND fields are visible and sent when set: altitude, bearing, hdop, charge, driverUniqueId, cell, wifi and distance. Raceradar currently ignores these extra fields. App settings from the URL are shown separately as read-only values.
- Default timestamp mode is **Jetzt**, which sends the current time for live testing. **GPX-Zeit** preserves historical timestamps and requires timestamps in the GPX. Raceradar marks map positions green below 60 seconds, yellow below 600 seconds and red from 600 seconds of measurement age.
- Traccar Client configuration parameters `accuracy`, `distance`, `interval`, `buffer`, `stop_detection` are removed from the target URL. In particular, `accuracy=highest` is an app setting, while Raceradar's `accuracy` measurement must be numeric meters.
- Waits for each response before scheduling another point and stops on errors. Successful responses show `accepted` and `duplicates`.
- Map assets require internet access (Leaflet and OpenStreetMap).

## License

Copyright (C) 2026 mb4umi. Licensed under the GNU General Public License v3.0 only (`GPL-3.0-only`). See [LICENSE](LICENSE) for the full terms.

This program is distributed without any warranty. Leaflet is loaded from its CDN and remains under its own BSD-2-Clause license; OpenStreetMap data and tiles retain their own licensing and usage requirements.

## Playback speed and Noise

**Interval · Sendeabstand** always controls the sending cadence, including fast forward. The URL's `interval` initializes this value. The first position is sent immediately; subsequent requests start no more often than this interval. On every tick, the emulator chooses the latest reached GPX point and drops intermediate points. A slow response skips missed ticks; there are no catch-up bursts.

**Current speed (km/h)** controls travel along the source GPX, independent of the sending interval. At 36 km/h with a 10-second interval, points are sampled about every 100 meters; at 72 km/h, about every 200 meters. Empty speed uses original GPX time gaps; missing or decreasing timestamps fall back to one interval per segment. Identical GPX times can be skipped together. Live mode sends the current time; speed-overridden historical mode starts at the selected GPX timestamp and advances by elapsed playback time. The final point is sent on a regular tick. Playback speed, interval and timestamp mode are locked during playback. SOS during playback is queued for the next regular request; while stopped it is sent immediately.

**Noise** adds an independent, uniformly distributed position offset within the configured radius in meters to each request, including SOS. Zero disables it. The source GPX, calculated distance, speed and scheduling are unaffected. Latitude/longitude readouts, request preview and map markers show the noisy position. Accuracy is configured separately.

Run behavior checks with `node test-emulator.cjs`.

## Choose the GPX start on the map

The tracking URL is shown in plain text. After loading a GPX, click the map to select the nearest track point as the playback start. A green marker and point number show the selection. Playback and the fast-forward timeline start at that point; historical mode uses its timestamp as the origin. Selection is locked while running or sending. **Start zurücksetzen** selects the first GPX point again. On overlapping laps, the first equally near point is selected. Distance remains cumulative from the original file's first point.

## OpenStreetMap tiles

Tiles load directly from the official `https://tile.openstreetmap.org/{z}/{x}/{y}.png` endpoint with visible linked attribution. HTML responses use `Referrer-Policy: strict-origin-when-cross-origin`, so tile requests include the local app origin without leaking page paths or tracking credentials. Browser caching of tile responses is unchanged; the emulator does not proxy, prefetch or bulk-download tiles. See https://operations.osmfoundation.org/policies/tiles/.
