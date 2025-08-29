import { initializeMouseCoordinates } from "./coordinates-mouse-move.js";
import { initializeBaselayers } from "./baselayers.js";
import { initializeSunModule } from "./sun-module.js";
import { initializeAddressSearch } from "./address-search.js";
import { initializeSplashScreen } from "./splash-screen.js";
import { initializeMeasureTools } from "./measure-tool.js";
import { initializeHideBuildings } from "./hide-buildings.js";
import { initializeBuildings } from "./buildings.js";
import { initializeProjects } from "./projects.js";
import { initializeEventListeners } from "./event-listeners.js";
import { initializeSectionToolChartContainer } from "./ui-terrain-section.js";
import { initialCameraView } from "./utils.js"
import { initializeVasttrafik } from "./vasttrafik/vasttrafik.js";
import { initializeVasttrafikHandlers } from "./vasttrafik/vasttrafik-handlers.js";
import { initializeView } from "./view.js";


initializeBaselayers()
initializeMouseCoordinates()
initializeSunModule()
initializeAddressSearch()
initializeSplashScreen()
initializeMeasureTools()
initializeHideBuildings()
initializeBuildings()
initializeProjects()
initializeSectionToolChartContainer()
initializeEventListeners()
initializeView()

initializeVasttrafik()
initializeVasttrafikHandlers()



initialCameraView("../json/projects.json")
  


