# Night-time Lights and Development in Ghana

**Ghana Statistical Service, Data Science Unit**: interactive site at **https://petermwinlaaru.github.io/ghana-night-lights/**

District evidence from satellite night-time lights, 2012–2025: settlement growth, socio-economic development,
access to electricity and economic activity across Ghana's 261 districts. Estimates from night-time lights are
experimental statistics: they complement, and do not replace, official statistics.

This repository holds the published static site only (HTML, JavaScript, data files and images). It runs in any
browser with no server-side code. Data files are in `data/GHA/`, with column definitions in
`data/GHA/data_dictionary.csv`.

## Sources
- Night-time lights: VIIRS Day/Night Band annual and monthly composites, Earth Observation Group, Payne Institute,
  Colorado School of Mines.
- 2021 Population and Housing Census and District rankings, Ghana Statistical Service.
- WorldPop population estimates (2012–2020); MODIS, FAO, Copernicus Sentinel-5P and CHIRPS for the GDP study.
- District boundaries: Ghana Statistical Service (261 districts).

The design draws on the night-time lights workshop materials of the African Development Bank's Data Innovation for
Africa (DI4A) programme. Built with Leaflet and Plotly.

## How to cite
Ghana Statistical Service, Data Science Unit (2026). *Night-time Lights and Development in Ghana* [web application
and data]. Accra: GSS. https://petermwinlaaru.github.io/ghana-night-lights/
