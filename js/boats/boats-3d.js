
const portTender = {
  uri: await Cesium.IonResource.fromAssetId(3726879),
  scale: 1.35,
  elevation: 1
}
const pilotVessel = {
  uri: await Cesium.IonResource.fromAssetId(3726888),
  scale: 0.85,
  elevation: 2.5
}
const sailingBoat = {
  uri: await Cesium.IonResource.fromAssetId(3726894),
  scale: 4,
}
const fishingBoat = {
  uri: await Cesium.IonResource.fromAssetId(3726871),
  scale: 0.2,
  elevation: -1
}
const cargo = {
  uri: await Cesium.IonResource.fromAssetId(3736958),
  scale: 0.25,
  elevation: -2
}
const tug = {
  uri: await Cesium.IonResource.fromAssetId(3725881),
  scale: 0.75,
  elevation: 8
}
const tanker = {
  uri: await Cesium.IonResource.fromAssetId(3711261),
  scale: 0.09,
  elevation: -5
}
const highSpeedCraft = {
  uri: await Cesium.IonResource.fromAssetId(3727183),
  scale: 2.5,
  elevation: 2
}
const wig = {
  uri: await Cesium.IonResource.fromAssetId(3711299),
  scale: 0.75,
  elevation: 0.75
}

export const boatMap3Dmodels = new Map()

boatMap3Dmodels.set("Port Tender", portTender)
boatMap3Dmodels.set("Pilot Vessel", pilotVessel)
boatMap3Dmodels.set("Sailing", sailingBoat)
boatMap3Dmodels.set("Pleasure Craft", sailingBoat)
boatMap3Dmodels.set("Cargo", cargo)
boatMap3Dmodels.set("Fishing", fishingBoat)
boatMap3Dmodels.set("Tug", tug)
boatMap3Dmodels.set("Tanker", tanker)
boatMap3Dmodels.set("High speed craft (HSC)", highSpeedCraft)
boatMap3Dmodels.set("Wing in ground (WIG)", wig)