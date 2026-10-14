# Traccar Emulator (for Raceradar)

A simple standalone HTML/JavaScript tool to simulate a GPS tracker sending GPX data to a Raceradar OSMAND ingest endpoint.

## Features
- Load a GPX file and display its track points on a Leaflet map.
- Configure the target tracking URL (e.g., `https://raceradar.de/ingest/osmand?token=…`).
- Adjust playback speed (seconds per point).
- Option to send an SOS alarm (`alarm=sos`) with each point.
- Start/Stop streaming of points with configurable interval.
- Visual feedback of sent points on the map (red for SOS, blue otherwise).
- Log of sent requests and responses.

## Usage
1. Open `index.html` in a modern browser (served via HTTP, not `file://` if you encounter CORS issues).
2. Click **GPX File** to select a GPX track.
3. Enter the **Tracking URL** (your personal ingest link with token).
4. Set **Speed** (default 1 second between points).
5. Optionally check **Send SOS alarm**.
6. Press **Start Streaming** to begin sending points.
7. Press **Stop Streaming** to halt.

## Notes
- The emulator sends data as `application/x-www-form-urlencoded` with fields: `lat`, `lon`, `alt=0`, `time` (ISO timestamp) and optionally `alarm=sos`.
- This matches the format expected by Raceradar's OSMAND adapter (`adata.get("alarm") == "sos"`).
- For local testing, you may need to serve the folder via a simple web server (e.g., `python -m http.server`) to avoid CORS blocks when making POST requests to the Raceradar API.
- The map uses OpenStreetMap tiles via Leaflet.

## License
This is a small helper tool; feel free to adapt and reuse.
