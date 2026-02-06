# Planet texture credits

This directory contains low-resolution textures used by the Orrery demo.

Most textures here are **256×128** PNGs (lightweight demo goal), but a few Earth-specific layers are higher-resolution to support atmosphere / clouds / night lights.

## Licensing notes

- **NASA media** is generally not subject to copyright in the United States. NASA requests acknowledgement of NASA as the source and prohibits implying NASA endorsement.
  - NASA guidelines: https://www.nasa.gov/multimedia/guidelines/index.html
- **USGS authored/produced information** is generally in the U.S. public domain; USGS requests acknowledgement as the source.
  - USGS FAQ: https://www.usgs.gov/faqs/are-usgs-reportspublications-copyrighted

## Per-file sources

- `mercury.jpg`: USGS Astrogeology Science Center — MESSENGER MDIS Basemap Enhanced Color Global Mosaic (665m). Product page: https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_enhanced_color_global_mosaic_665m. Download: https://upload.wikimedia.org/wikipedia/commons/4/41/Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_32ppd.jpg
- `mars-viking-colorized-4k.jpg`: USGS Astrogeology Science Center — Mars Viking Colorized Global Mosaic 232m.
  - Product page: https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m
  - Download used (derived/downscaled): https://astrogeology.usgs.gov/ckan/dataset/7131d503-cdc9-45a5-8f83-5126c0fd397e/resource/5ea881c6-01b3-41fa-a7af-42d2131b54f1/download/mars_viking_mdim21_clrmosaic_1km.jpg
  - License: USGS-authored content is generally U.S. public domain; USGS requests acknowledgement as the source (see FAQ above)
- (planned) `mars-mola-normal-2k.png` / `mars-roughness-proxy-2k.png`
  - Intended source DEM: USGS Astrogeology Science Center — **Mars MGS MOLA DEM 463m** (MEGDR). Product page: https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m
  - Access constraints listed by USGS: CC0 / public domain.
  - Notes:
    - The full-resolution GeoTIFF is large; for a lightweight 2k/4k export, USGS recommends using **Map-a-Planet** to convert/reproject and download PNG/JPG without pulling the full DEM.
      - MAP overview: https://www.usgs.gov/special-topics/planetary-geologic-mapping/map-planet-astrogeology-cloud-processing
    - Normal map should be derived from the DEM (not from albedo / shaded relief).
    - Roughness proxy is intended to start as a synthetic map derived from DEM slope + albedo luminance.
- `moon-lroc-4k.jpg`
  - Source (SVS): https://svs.gsfc.nasa.gov/4720/ ("CGI Moon Kit")
  - Credit: NASA's Scientific Visualization Studio
  - Notes: derived from LRO / LROC WAC global mosaic products (ASU), with additional LOLA products (per SVS page)
