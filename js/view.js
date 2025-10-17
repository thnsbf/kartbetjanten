import { readJson } from "./utils.js";
import { initializeVasttrafik, deInitializeVasttrafik } from "./vasttrafik/vasttrafik.js";
import { initializeVasttrafikHandlers, removeVasttrafikHandlers } from "./vasttrafik/vasttrafik-handlers.js";
import { deInitializeBridges, initializeBridges, initializeBoats, deInitializeBoats } from "./boats/boats.js";

export async function initializeView() {
  const json = await readJson("../json/view.json")
  initializeViewItemsInNav(json)
}

function initializeViewItemsInNav(viewItems) {
  const parentUl = document.getElementById("sub-menu-view")

  for (let i = 0; i < viewItems.length; i++) {
    const { id, name } = viewItems[i]
    const liItem = document.createElement("li")
    liItem.classList.add("sub-menu-item")
    liItem.innerHTML = `
      <input type="checkbox" class="custom-checkbox" id="view-checkbox-${id}">
      <label for="view-checkbox-${id}" class="sub-menu-item__label" id="zoom-btn-${id}">${name}</label>
    `
    parentUl.appendChild(liItem)
    const mountedLiItem = document.getElementById(`zoom-btn-${id}`)
    mountedLiItem.addEventListener('click', (e) => viewClickListener(e));
  }
}

function viewClickListener(e) {
  const { childNodes } = e.target.parentNode
  const checkbox = Array.from(childNodes).find(node => node.type === "checkbox")
  if (!checkbox) throw new Error("Could not find a checkbox in parent node")
  
  const id = checkbox.id.slice(14)
  const toBeStarted = !checkbox.checked
  startAndStopViewModule(id, toBeStarted)
}


async function startAndStopViewModule(id, toBeStarted) {
  const json = await readJson("../json/view.json")
  const moduleFromJson = json.find(viewItem => viewItem.id === id)
  if (!moduleFromJson) throw new Error("Could not find a matching id for view item")

  switch (id) {
    case "lokaltrafik":
      if (toBeStarted) {
        initializeVasttrafik()
        initializeVasttrafikHandlers()
        
      } else {
        deInitializeVasttrafik()
        removeVasttrafikHandlers()
      }
      break
    case "brooppningar":
      if (toBeStarted) {
        initializeBridges()
      } else {
        deInitializeBridges()
      }
      break
    case "battrafik":
      if (toBeStarted) {
        initializeBoats()
      } else {
        deInitializeBoats()
      }
      break
  }
}