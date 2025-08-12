Detta är en den första utgåvan av en 3D-karta webbapplikation som Swesium 
(vilket är ett kommunalt samverkande mellan kommuner för användning av Cesium)
släpper till kommuner. Samarbetet började med Trollhättan-, Umeå- och Örebro kommun,
där sedan Avesta-, Fagesta-, Norberg- och Uddevalla kommun tillkommit. Idag är det ännu fler
kommuner som är med och har visat intresse för en kommunal samverkan inom Cesium.

Första utgåvan är sammanställd av de sju kommunerna ovan och framtida utveckling kommer 
ske med fler kommuner som visat intresse för en gemensam vidareutveckling av webbapplikationen.

Det här behöver du göra för att komma igång: 
Skapa dina egna adresser för adressöken, under mappen "FME" finns ett flöde som hjälper dig med det. 


Funktioner i första utgåvan:
Ta skärmklipp,
dela vy,
fotgängarläge,
gömma byggnader,
sektionsverktyg,
rita 3D polygoner,
mätverktyg,
solstudie,
koordinat och höjdanvisning efter muspekare,
val av bakgrundskartor och bakgrundsterräng
stadsdelar (snabbzoom til områden),
adressök mot json-fil,
navigeringshjälp,
kompass med zoom Funktioner
css variabler för att styra kommunfärg,
möjlighet till logga eller text i menyn,
mobilanpassning

Kommande version kommer innehålla objekt-meny för lager och sektionsverktyg.

Notera att om er kommun kommer använda ion så måste ni ha med attribution till CesiumIon.
Kommentera ut följande i styles.css:
.cesium-viewer-bottom {
    display: none !important;
}

Du behöver också lägga till anrop till din Cesium ION token. 

För att sätta upp 3D-kartan är det bra om viss kännedom för html, css och js finns.
