# Kartbetjänten

Ändra baskarta: Viewer.jsx 88
Adresser: GeoJSON (JSON)-fil läggs under public/json med namnet "adresser.json".

Format GeoJSON för adresser

Varje adress ska vara en egen Feature med geometrityp "point", och behöver innehålla unika värden för

- Koordinater (coordinates)
- Adress (ADRESS)
- Fastighet (FASTIGHET)

Exempel:

```{
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

För att köra i dev-miljö: npm run dev
För att bygga: npm run build
