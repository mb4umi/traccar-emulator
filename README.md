# Traccar Emulator for Raceradar

Replay GPX track points to Raceradar's OSMAND ingest endpoint, with a Leaflet map and request log.

## Start locally

Requires Python 3 and curl (available on macOS). No Python packages are needed.

```sh
python3 server.py --port 8765
```

Open http://127.0.0.1:8765, select a GPX file, enter your tracking URL (`https://raceradar.de/ingest/osmand?id=…`), set seconds per point and click **Start**. **Stop** stops playback. **Send SOS once** sends exactly one SOS position using the last successful point (or the selected GPX start point before playback). Normal playback never includes an SOS flag.

Use `server.py` instead of a generic static HTTP server: Raceradar does not enable browser CORS, so the local server forwards requests and returns the actual HTTP status and response. It listens only on loopback and forwards only to `https://raceradar.de/ingest/osmand`. Tracker credentials are not saved in the source or request logs. HTTPS certificates are verified by curl.

## Payload and playback

- Sends form fields `lat`, `lon`, `timestamp` (ISO UTC), `accuracy`, `batt`, `valid`, speed in knots and optionally `alarm=sos`. Speed and cumulative distance are calculated from GPX geometry and original time differences. Accuracy, speed and battery can be overridden.
- Additional OSMAND fields are visible and sent when set: altitude, bearing, hdop, charge, driverUniqueId, cell, wifi and distance. Raceradar currently ignores these extra fields. App settings from the URL are shown separately as read-only values.
- Default timestamp mode is **Now**, which sends the current time for live testing. **GPX time** preserves historical timestamps and requires timestamps in the GPX. Raceradar marks map positions green below 60 seconds, yellow below 600 seconds and red from 600 seconds of measurement age.
- Traccar Client configuration parameters `accuracy`, `distance`, `interval`, `buffer`, `stop_detection` are removed from the target URL. In particular, `accuracy=highest` is an app setting, while Raceradar's `accuracy` measurement must be numeric meters.
- Waits for each response before scheduling another point and stops on errors. Successful responses show `accepted` and `duplicates`.
- Map assets require internet access (Leaflet and OpenStreetMap).

## License

Copyright (C) 2026 mb4umi. Licensed under the GNU General Public License v3.0 only (`GPL-3.0-only`). See [LICENSE](LICENSE) for the full terms.

This program is distributed without any warranty. Leaflet is loaded from its CDN and remains under its own BSD-2-Clause license; OpenStreetMap data and tiles retain their own licensing and usage requirements.

## Playback speed and Noise

**Send interval** always controls the sending cadence, including fast forward. The URL's `interval` initializes this value. The first position is sent immediately; subsequent requests start no more often than this interval. On every tick, the emulator chooses the latest reached GPX point and drops intermediate points. A slow response skips missed ticks; there are no catch-up bursts.

**Current speed (km/h)** controls travel along the source GPX, independent of the sending interval. At 36 km/h with a 10-second interval, points are sampled about every 100 meters; at 72 km/h, about every 200 meters. Empty speed uses original GPX time gaps; missing or decreasing timestamps fall back to one interval per segment. Identical GPX times can be skipped together. Live mode sends the current time; speed-overridden historical mode starts at the selected GPX timestamp and advances by elapsed playback time. The final point is sent on a regular tick. Playback speed, interval and timestamp mode are locked during playback. SOS during playback is queued for the next regular request; while stopped it is sent immediately.

**Noise** adds an independent, uniformly distributed position offset within the configured radius in meters to each request, including SOS. Zero disables it. The source GPX, calculated distance, speed and scheduling are unaffected. Latitude/longitude readouts, request preview and map markers show the noisy position. Accuracy is configured separately.

Run behavior checks with `node test-emulator.cjs`.

## Choose the GPX start on the map

The tracking URL is shown in plain text. After loading a GPX, click the map to select the nearest track point as the playback start. A green marker and point number show the selection. Playback and the fast-forward timeline start at that point; historical mode uses its timestamp as the origin. Selection is locked while running or sending. **Reset start** selects the first GPX point again. On overlapping laps, the first equally near point is selected. Distance remains cumulative from the original file's first point.

## OpenStreetMap tiles

Tiles load directly from the official `https://tile.openstreetmap.org/{z}/{x}/{y}.png` endpoint with visible linked attribution. HTML responses use `Referrer-Policy: strict-origin-when-cross-origin`, so tile requests include the local app origin without leaking page paths or tracking credentials. Browser caching of tile responses is unchanged; the emulator does not proxy, prefetch or bulk-download tiles. See https://operations.osmfoundation.org/policies/tiles/.

## Loop

Loop is available only when the original GPX first and last coordinates are less than 100 meters apart (not the noisy coordinates). Enable **Loop** before starting. The first pass begins at the selected start point; subsequent passes begin at the original GPX beginning. The final point and the next loop's start are sent on separate regular interval ticks. Historical timestamps advance across loops to avoid replaying identical event timestamps. Stop ends looping.

## JSON replay with up to three devices

Load a JSON array of Raceradar-exported positions in the **JSON** section. Required fields: `device_id`, `measured_at`, `latitude`, `longitude`. Optional `accuracy_m`, `speed_mps` and `battery_percent` become OSMAND `accuracy`, speed in knots and `batt`. Data is validated and sorted chronologically per device. The JSON file stays in the browser; only selected positions are sent when playback starts.

Choose up to three distinct source IDs and enter a different Raceradar tracking URL for each. The source `device_id` selects a track; the ID/token in its assigned URL authenticates the destination. Empty selections are skipped. Click **Start JSON replay**: requests for all due devices start concurrently. One device's failure stops that device and reports its error while the other devices continue. **Stop JSON replay** prevents further requests, though in-flight requests may finish.

The JSON section has its own fixed interval, time factor (1× original pace, 10× faster) and timestamp mode. The shared replay clock preserves start offsets between devices. Each tick sends only the latest reached point per device; repeated points and intermediate points are skipped. Default timestamps shift the export to the current time, preserving relative timing. Original-time mode sends the exported timestamps. Global Noise applies; GPX overrides, SOS, map start selection and Loop remain GPX features. GPX and JSON playback cannot run together.

Tests use simulated responses for three destination trackers; optionally validate a real export with `node test-emulator.cjs /path/to/export.json`.

## Traccar configuration links

All tracking URL fields accept direct HTTPS URLs and `org.traccar.client://config?url=https%3A%2F%2Fraceradar.de%2Fingest%2Fosmand&id=YOUR_TRACKER_ID&accuracy=highest&distance=0&interval=10&buffer=true&stop_detection=false`. The emulator extracts the encoded server URL and merges the tracker ID and settings from the configuration link. Only the validated Raceradar HTTPS OSMAND endpoint receives positions; client settings are removed before forwarding. The GPX settings display reads the config link's interval and other settings as usual. JSON retains its separate replay interval.

Run URL parsing tests with `python3 -m unittest test_server.py`.

## Speed variation

**Speed variation ± (km/h)** adds a smooth sine wave around **Current speed** with a randomized phase at each GPX start. **Variation cycle (seconds)** sets the period. A base of 30 km/h and ±10 km/h produces speeds between 20 and 40 km/h. Values are clamped at zero when the amplitude exceeds the base speed, allowing stationary phases. The integrated speed determines distance traveled along the GPX, while the transmitted speed uses the same waveform. The send interval is unchanged and intermediate GPX points are skipped. Zero amplitude disables variation. GPS position noise is independent, and JSON replay retains its own timing and source measurements.
