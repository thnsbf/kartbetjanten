# Kartbetjänten

I detta repot finner du källkoden till Trollhättans Stads egenbyggda internettjänst Kartbetjänten.
Detta är en ren frontend-lösning och kräver ingen server eller backend för att fungera. Det enda som behövs
är en GeoJSON-fil som innhåller de adresser och fastigheter som ingår i kommunen, samt en WMS-url för er egen kommunkarta. 
Längre ner i denna texten beskrivs GeoJSON-formatet med exempel.

##### Ändra baskarta: Viewer.jsx 88 (src/components/Viewer/Viewer.jsx)
##### Adresser: GeoJSON (JSON)-fil läggs under public/json med namnet "adresser.json".

---

### Format GeoJSON för adresser

Varje adress ska vara en egen Feature av geometrityp "point", och behöver innehålla unika värden för

- Koordinater (coordinates)
- Adress (ADRESS)
- Fastighet (FASTIGHET)

Exempel:

```geojson{
	"type" : "FeatureCollection",
	"name" : "NewFeatureType",
	"features" : [
		{
			"type" : "Feature",
			"geometry" : {
				"type" : "Point",
				"coordinates" : [ 12.2832492552, 58.2899583603 ]
			},
			"properties" : {
				"ADRESS" : "ALBERTSVÄGEN 1",
				"FASTIGHET" : "STENNÄSET 1"
			}
		},
		{
			"type" : "Feature",
			"geometry" : {
				"type" : "Point",
				"coordinates" : [ 12.2820746085, 58.289603655 ]
			},
			"properties" : {
				"ADRESS" : "ALBERTSVÄGEN 2A",
				"FASTIGHET" : "GRANLIDEN 1"
			}
		},
    ... FLER ADRESSER...
  ]
}
```

- För att köra i dev-miljö: npm run dev
  
- För att bygga: npm run build
