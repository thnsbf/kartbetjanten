# Kartbetjänten

I detta repot finner du källkoden till Trollhättans Stads egenbyggda internettjänst Kartbetjänten.
Detta är en ren frontend-lösning och kräver ingen server eller backend för att fungera. Det enda som behövs
är en GeoJSON-fil som innhåller de adresser och fastigheter som ingår i kommunen, samt en WMS-url för er egen kommunkarta. 
Längre ner i denna texten beskrivs GeoJSON-formatet med exempel.

##### Ändra baskarta: Viewer.jsx 88 (src/components/Viewer/Viewer.jsx)
##### Adresser: GeoJSON (JSON)-fil läggs under public/json med namnet "adresser.json".

---

### Kom igång

Öppna huvudmappen i terminalen och kör

```npm install```
```npm run dev```

För att bygga kör

```npm run build```

OBS! Kom ihåg att en adresser.json-fil och en egen wms-karta behövs innan verktyget går att använda!

### Format GeoJSON för adresser


Varje adress behöver vara en egen Feature av geometrityp "point", och behöver innehålla unika värden för

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

### Styling

Under src/index.css definieras färg, storlekar, och samt text-font.


### Bibliotek

Vite
React.js
CesiumJS
UUID
JSPDF


---

## Gränssnittet

Kartbetjänten är ett verktyg som möjliggör skapandet av egna ärendekartor för invånare i kommunen. 
Appen innehåller verktyg för att

* Placera punkt
* Rita linje
* Rita area
* Placera text
* Flytta objekt

Alla objekt som ritas ut på kartan syns även i en separat lista kallad "Mina objekt". 
Därifrån har användaren möjlighet att både redigera samt ta bort objekt.
Objekt kan också öppnas i redigeringsläge genom att klicka på objektet i kartan.

Borttagna objekt syns i en egen lista där de kan återställas, eller tas bort definitivt (effektivt "töm papperskorgen").

När användaren är nöjd med sin karta kan den skrivas ut genom att klicka på "Ladda ner". Kartan kan sparas både i PDF-format
och som en GeoJSON innehållandes de geometrier som användaren ritat i data-format.


