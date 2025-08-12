import { flyToLoc } from "./zoom-functions.js";
import { initializeAsset } from "./buildings.js";
import { viewer } from "./viewer.js";
import { handleBaselayerButtonClick } from "./baselayers.js";
import { hideShowElem } from "./ui-helpers.js";
import { initializeChart } from "./chartjs.js";
import { startLoadingSpinner, removeLoadingSpinner } from "./loading-spinner.js";
import { CESIUM_COLORS_DOM } from "./colors/colors.js";
import { waitForTerrainToLoad, arbitraryPause } from "./utils-cesium.js";

let PROJECTS;
const activeProjects = [] // ProjectIDs
let activeProjectAssets = [] // Tilesets

export async function initializeProjects() {
  try {
    const jsonUrl = new URL("../json/projects.json", import.meta.url);
    console.log(jsonUrl)
    const response = await fetch(jsonUrl);
    PROJECTS = await response.json();
    initializeProjectsInNav(PROJECTS)

  } catch (error) {
    console.error("Error loading Projects-JSON:", error);
  }
}

function removeProject(projectId) {
  // Clean up in the viewer
  removeProjectAssetsFromScene(projectId)
  // Clean up in the DOM
  removeProjectFromDom(projectId)
}

function initializeProjectsInNav(PROJECTS) {
  const parentUl = document.getElementsByClassName("zoom-sub-menu")[0]
  const { features } = PROJECTS
  console.log(parentUl.childNodes)
  console.log(features[0].properties)

  for (let i = 0; i < features.length; i++) {
    const { id, name } = features[i].properties
    const liItem = document.createElement("li")
    liItem.classList.add("sub-menu-item")
    liItem.innerHTML = `
      <input type="checkbox" class="custom-checkbox" id="projekt-checkbox-${id}">
      <label for="projekt-checkbox-${id}" class="sub-menu-item__label" id="zoom-btn-${id}">${name}</label>
    `
    parentUl.appendChild(liItem)
    const mountedLiItem = document.getElementById(`zoom-btn-${id}`)
    mountedLiItem.addEventListener('click', () => viewProject(id));
  }
}

export async function viewProject(projectId) {
  const project = PROJECTS.features.find(proj => proj.properties.id === projectId)
  if (!project) {
    console.log('Project with provided id not found: ', projectId)
    console.log('PROJECTS: ', PROJECTS) 
    return
  }
  const isAlreadyActive = setActiveProject(projectId)

  if (isAlreadyActive) {
    // Remove all associated project-assets from the scene
    removeProject(projectId)
    setTimeout(() => {
      const checkbox = document.getElementById("projekt-checkbox-" + projectId)
      checkbox.checked = false
    }, 10);
    
    return
  }
  const loadingSpinner = startLoadingSpinner()
/*   await arbitraryPause()
 */  const ortofotoBtn = document.getElementById('Baselayer-button3')
  if (!ortofotoBtn.checked) {
    handleBaselayerButtonClick(ortofotoBtn, 'theme-ortofoto_2022')
    ortofotoBtn.dispatchEvent(new Event('change'))
    ortofotoBtn.checked = true
  }
  const [lat, long] = project.geometry.coordinates
  const alt = project.properties.camera.altitude
  const { heading, pitch, roll } = project.properties.camera.orientation
  
  createProjectModal(project)
/*   if (project.properties.camera.preFlightAltitude) flyToLoc(lat, long, project.properties.camera.preFlightAltitude, heading, pitch, roll)
 */  
  for (const asset of project.properties.ionAssets) {
      const totPayloadValues = []

    for (const curId of asset.ionIds) {
      const tileset = await initializeAsset(curId, asset, project.properties.name)
      tileset.show = asset.showDefault
      tileset.projectId = projectId
      tileset.assetId = asset.assetGroupId
      if (asset.payloadKeyname) totPayloadValues.push(tileset[asset.payloadKeyname])
      activeProjectAssets.push(tileset)
    }
    let obj

    if (asset.colorCategoryWindow) {
      const colorCategoryWindow = createColorCategoryWindow(asset)
      obj = {
        elem: colorCategoryWindow,
        projectId,
        assetType: "geojson",
        assetId: asset.assetGroupId
      }
      activeProjectAssets.push(obj)
    } else if (asset.createStatsWindow) {
      console.log(activeProjectAssets[activeProjectAssets.length - 1])
      const statsWindow = createStatsWindow(asset, asset.assetGroupId, project.properties.name, totPayloadValues)
      obj = {
        elem: statsWindow,
        projectId,
        assetType: "geojson",
        assetId: asset.assetGroupId
      }
      activeProjectAssets.push(obj)
    }
  }
  flyToLoc(lat, long, alt, heading, pitch, roll)
  console.log(activeProjectAssets)
  removeLoadingSpinner(loadingSpinner)
}

function setActiveProject(projectId) {
  const index = activeProjects.indexOf(projectId)
  if (index === -1) {
    activeProjects.push(projectId)
  } else (
    activeProjects.splice(index, 1)
  )
  // Returning the answer to the question "Was this Project already active when clicking the button?"
  return index > -1 ? true : false
}

function removeProjectAssetsFromScene(projectId) {
  activeProjectAssets.forEach(asset => {
    if (asset.projectId === projectId) {
      if (asset._imageryProvider) {
        viewer.imageryLayers.remove(asset);
      } else if (asset.assetType && asset.assetType === 'polygonWithImage') {
        viewer.entities.remove(asset)
      } else if (asset.assetType && asset.assetType === 'controller') {
        
      } else if (asset.assetType && asset.assetType === 'geojson') {
        asset.tilesets?.forEach(tileset => {
          viewer.entities.remove(tileset)
        })
        if (asset.elem) {
          asset.elem.remove()
        }
        viewer.entities.remove(asset)
        
      } else if (asset.assetType && asset.assetType === "infoWindow") {
        asset.elem.remove()
      } else if (asset.assetType && asset.assetType === 'geojsonBuildingExtrusion') {
        asset.tilesets.forEach(tileset => {
          viewer.entities.remove(tileset)
        })
        viewer.entities.remove(asset)
      } else if (asset.assetType && asset.assetType === 'multiPolygon' ) {
        if (asset.tilesets) {
          asset.tilesets.forEach((tileset) => {
            viewer.entities.remove(tileset)
          })
        if (asset.statsWindow) {
          asset.statsWindow.remove()
        }
        }
      } else {
        viewer.scene.primitives.remove(asset);
      }
    
    }
  })
  activeProjectAssets = activeProjectAssets.filter(asset => asset.projectId !== projectId)
}

function changeProjectAssetVisibility(assetGroupId, isShown) {
  const assets = activeProjectAssets.filter(asset => asset.assetId === assetGroupId)
  if (assets.length < 1) {
    console.log('Asset with provided assetId not found: ' + assetGroupId)
    return
  }

  for (const asset of assets) {
    if (asset.assetType === "multiPolygon" || asset.assetType === "geojson" || asset.assetType === "geojsonBuildingExtrusion") {
      asset.tilesets?.forEach((tileset) => {
        tileset.show = isShown
      })
    } else if (asset.assetType === "controller") {
      if (asset.target) {
        if (isShown) {
          asset.target.dispatchEvent(new Event('click'))
          asset.target.checked = true
        } else {
          const navResetElem = asset.target.parentNode.nextElementSibling.firstChild.nextElementSibling.nextElementSibling
          navResetElem.dispatchEvent(new Event('click'))
          navResetElem.checked = true
        }
      }
    } else {
      asset.show = isShown
    }
    if (asset.elem) hideShowElem(asset.elem)
  }
}

function handleH3Click(lat, long, alt, heading, pitch, roll) {
    
  flyToLoc(lat, long, alt, heading, pitch, roll)
}

// Project elements

function createProjectModal(project) {
  const { id, name, ionAssets } = project.properties
  const [lat, long] = project.geometry.coordinates
  const alt = project.properties.camera.altitude
  const { heading, pitch, roll } = project.properties.camera.orientation

  // Wrapper
  let wrapperElem = document.createElement('div');
  wrapperElem.id = "project-" + id
  wrapperElem.classList.add('project-modal')
  // H3
  let h3Elem = document.createElement('h3');
  h3Elem.classList.add('modal-h3')
  h3Elem.classList.add('modal-h3--project')
  h3Elem.id = "project-h3-" + id
  h3Elem.textContent = name
  h3Elem.addEventListener("click", () => handleH3Click(lat, long, alt, heading, pitch, roll))

  

  // Header
  let headerElem = document.createElement('header');
  headerElem.classList.add('project-modal__header')
  headerElem.appendChild(h3Elem)
  wrapperElem.appendChild(headerElem)
  // Header buttons

  if (!project.properties.defaultCheckProject) {

    let xCloseBtnElem = document.createElement('button')
    xCloseBtnElem.classList.add('close-btn')
    xCloseBtnElem.id = "x-close-btn-" + id
    xCloseBtnElem.innerHTML = `
      <i>
        <img src="img/x-close.svg" alt="Close project: ${name}">
      </i>
    `
    headerElem.appendChild(xCloseBtnElem)

  }

  let minimizeMaximizeBtnElem = document.createElement('button')
  minimizeMaximizeBtnElem.classList.add('minus-btn')
  minimizeMaximizeBtnElem.classList.add('minus-btn--project')
  minimizeMaximizeBtnElem.id = "minus-btn-" + id
  minimizeMaximizeBtnElem.innerHTML = `
    <i>
      <img src="img/minus-purple.svg" alt="Minimize project-modal">
    </i>
  `

  headerElem.appendChild(minimizeMaximizeBtnElem)

  // Inner
 
  let innerElem = document.createElement('div');
  innerElem.classList.add('project-modal__inner')
  let ul = document.createElement('ul');
  ul.classList.add('project-modal-ul')

  // Show all/hide all-checkbox

  const firstLiElem = document.createElement('li')
  firstLiElem.classList.add('project-modal-item')
  firstLiElem.innerHTML = `
      <label for="${'all-none-' + id}">Visa/göm alla</label>
      <input id="${'all-none-' + id}" type="checkbox" name="${id}">
    `
  ul.appendChild(firstLiElem)
  
  // Layer-items

  const assetIds = []

  ionAssets.forEach(asset => {
    const wrapperElem = document.createElement('li')
    wrapperElem.classList.add('project-modal-item')
    const assetId = asset.assetGroupId.toString()
    wrapperElem.id = id + '-' + assetId
    wrapperElem.innerHTML = `
      <label for="${assetId}-input">${asset.name}</label>
      <input id="${assetId}-input" type="checkbox" name="${id}">
    `
    assetIds.push(assetId)
    ul.appendChild(wrapperElem)
  })

  
  innerElem.appendChild(ul)
  wrapperElem.appendChild(innerElem)

  // Project modal holder

  let projectModalHolder = document.getElementById('project-modal-holder') || document.createElement('div')
  if (projectModalHolder.id !== 'project-modal-holder') {
    projectModalHolder.id = 'project-modal-holder'
    projectModalHolder.classList.add('project-modal-holder')
  }

  projectModalHolder.appendChild(wrapperElem)

  if (!document.getElementById('project-modal-holder')) {
    document.body.appendChild(projectModalHolder)
  }

  ionAssets.forEach(asset => {
    const elem = document.getElementById(asset.assetGroupId + "-input")
    elem.checked = asset.showDefault
    elem.addEventListener("change", handleCheckboxChange)
  })
  firstLiElem.addEventListener("change", handleShowHideAllCheck)

  if (!project.properties.defaultCheckProject) {
    const xCloseBtnElemMounted = document.getElementById("x-close-btn-" + id)
    xCloseBtnElemMounted.addEventListener("click", handleCloseXBtn)
  }
  const minMaxBtnElemMounted = document.getElementById("minus-btn-" + id)
  minMaxBtnElemMounted.addEventListener("click", handleMinMaxClick)
}

function handleShowHideAllCheck(e) {
  const allCheckboxesInModal = document.getElementsByName(e.target.name)
  const isChecked = e.target.checked
  allCheckboxesInModal.forEach(checkbox => {
    if (checkbox.checked !== isChecked) {
      checkbox.checked = isChecked
      checkbox.dispatchEvent(new Event('change'))
    }
  })
}

export function defaultCheckProject(projectId) {
  const checkbox = document.getElementById("projekt-checkbox-" + projectId)
  checkbox.checked = true
  viewProject(projectId)
}


function removeProjectFromDom(projectId) {
  const h3Elem = document.getElementById("project-h3-" + projectId)
  h3Elem.removeEventListener("click", () => handleH3Click(lat, long, alt, heading, pitch, roll))
  const projectModalElem = document.getElementById("project-" + projectId)
  const allCheckboxesInModal = document.getElementsByName(projectId)
  allCheckboxesInModal.forEach(checkbox => {
    checkbox.removeEventListener("change", handleCheckboxChange)
  })
  const closeXBtn = document.getElementById("x-close-btn-" + projectId)
  if (closeXBtn) closeXBtn.removeEventListener("click", handleCloseXBtn)
  const minusBtn = document.getElementById("minus-btn-" + projectId)
  minusBtn.removeEventListener("click", handleMinMaxClick)
  projectModalElem.remove()
}

function handleCheckboxChange(e) {
  const formattedId = e.target.id.split("-")
  if (formattedId[formattedId.length - 1] === "input") formattedId.pop()
  const id = formattedId.join("-")
  changeProjectAssetVisibility(id, e.target.checked)
}

function handleCloseXBtn(e) {
  const projectId = e.currentTarget.id.slice(12)
  viewProject(projectId)
}

function handleMinMaxClick(e) {
  const btnElem = document.getElementById(e.currentTarget.id)
  const siblings = btnElem.parentNode.parentNode.childNodes
  let elemToBeMinimized = null
  for (let i = 0; i < siblings.length; i++) {
    if (siblings[i].classList[0].includes("__inner") && !elemToBeMinimized) {
      elemToBeMinimized = siblings[i]
    }
  }
  const imgElem = btnElem.querySelector("i > img")
  const imgIsArrow = imgElem.src.includes("img/icon-kommun-arrow-purple.svg")
  if (imgIsArrow) {
    imgElem.src = "img/minus-purple.svg"
    imgElem.alt = "Minimize project-modal"
  } else {
    imgElem.src = "img/icon-kommun-arrow-purple.svg"
    imgElem.alt = "Show project-modal"

  }
  minimizeMaximizeProjectModal(elemToBeMinimized, imgIsArrow)
}

function minimizeMaximizeProjectModal(innerElem, isToBeMaximized) {
  if (isToBeMaximized) {
    innerElem.style.display = "block"
    innerElem.style.visibility = "visible"
  } else {
    innerElem.style.display = "none"
    innerElem.style.visibility = "hidden"
  }

}

function handleCloseInfoWindow(e) {
  const wrapperElem = e.currentTarget.parentNode
  hideShowElem(wrapperElem)
  const checkbox = document.getElementById(wrapperElem.id + "-input")
  checkbox.checked = false
}

export function createInfoWindow(feature, assetGroupId, projectName) {
  let wrapperElem = document.createElement('div');
  wrapperElem.id = assetGroupId
  wrapperElem.classList.add('info-window-modal')

  let h3Elem = document.createElement('h3');
  h3Elem.classList.add('modal-h3')
  h3Elem.classList.add('modal-h3--info-window')
  h3Elem.id = "info-window-h3-" + assetGroupId
  h3Elem.textContent = feature.name + " " + projectName

  let xCloseBtnElem = document.createElement('button')
  xCloseBtnElem.classList.add('close-btn')
  xCloseBtnElem.classList.add('close-btn--info-window')

  xCloseBtnElem.id = "x-close-btn-" + assetGroupId
  xCloseBtnElem.innerHTML = `
    <i>
      <img src="img/x-close.svg" alt="Close asset: ${feature.name}">
    </i>
  ` 
  xCloseBtnElem.addEventListener("click", handleCloseInfoWindow)
  wrapperElem.appendChild(xCloseBtnElem)
  wrapperElem.appendChild(h3Elem)

  feature.content.forEach(paragraf => {
    let sectionElem = document.createElement('section');
    sectionElem.classList.add('info-window__section')

    let h4Elem = document.createElement('h4');
    h4Elem.classList.add('modal-h4')
    h4Elem.classList.add('modal-h4--info-window')
    h4Elem.id = "info-window-h4-" + paragraf.heading
    h4Elem.textContent = paragraf.heading

    let pElem = document.createElement('p');
    pElem.classList.add('modal-p')
    pElem.classList.add('modal-p--info-window')
    pElem.textContent = paragraf.body

    sectionElem.appendChild(h4Elem)
    sectionElem.appendChild(pElem)
    wrapperElem.appendChild(sectionElem)
    })

    document.body.appendChild(wrapperElem)
  if (!feature.showDefault) {
    hideShowElem(wrapperElem)
  }
  return wrapperElem

}


export function createStatsWindow(feature, assetGroupId, projectName, payloadArr) {

  // Wrapper
  let wrapperElem = document.createElement('div');
  wrapperElem.id = "stats-window-" + assetGroupId
  wrapperElem.classList.add('stats-window-modal')
  // H3
  let h3Elem = document.createElement('h3');
  h3Elem.classList.add('modal-h3')
  h3Elem.classList.add('modal-h3--stats-window')
  h3Elem.id = "stats-window-h3-" + assetGroupId
  h3Elem.textContent = projectName
  
  // h4
  let h4Elem = document.createElement('h4');
  h4Elem.classList.add('modal-h4')
  h4Elem.classList.add('modal-h4--stats-window')
  h4Elem.id = "stats-window-h4-" + assetGroupId
  h4Elem.textContent = feature.name

  

  // Header
  let headerElem = document.createElement('header');
  headerElem.classList.add('stats-window-modal__header')
  headerElem.appendChild(h3Elem)
  wrapperElem.appendChild(headerElem)

  let hrElem = document.createElement('hr');
  hrElem.classList.add("modal-hr")
  wrapperElem.appendChild(hrElem)

  // Inner
 
  let innerElem = document.createElement('div');
  innerElem.classList.add('stats-window-modal__inner')
  innerElem.appendChild(h4Elem)
  let ul = document.createElement('ul');
  ul.classList.add('stats-window-modal-ul')
  
  if (feature?.assetCategory === "surface") {
    for (let i = 0; i < feature.ionIds.length; i++) {
      const backgroundColor = `var(--${feature.name.toLowerCase()}-${feature.colors[i].toLowerCase()})`
    
      const liItem = document.createElement("li")
      liItem.classList.add("stat-feature-item")
      liItem.innerHTML = `
        <div class="stat-feature-item__color" style="background-color:${backgroundColor};"></div>
        <div>${feature.names[i]}</div>
        <div>${payloadArr[i]} ${feature.payloadUnit}</div>
      `
  
      ul.appendChild(liItem)
    }
  

  } else {
    feature.colors.forEach((color, i) => {
    const backgroundColor = CESIUM_COLORS_DOM[feature.colorCategory][color]
  
    const liItem = document.createElement("li")
    liItem.classList.add("stat-feature-item")
    liItem.innerHTML = `
      <div class="stat-feature-item__color" style="background-color:${backgroundColor};"></div>
      <div>${feature.height[i]} m</div>
      <div>${color}</div>
    `

    ul.appendChild(liItem)
  })
  }

  

  innerElem.appendChild(ul)
  let hrElem2 = document.createElement('hr');
  innerElem.appendChild(hrElem2)
  const chart = initializeChart(innerElem, feature, feature.payloadKeyname, payloadArr)

  wrapperElem.appendChild(innerElem)
  document.body.appendChild(wrapperElem)
  if (!feature.showDefault) {
    hideShowElem(wrapperElem)
  }
  return wrapperElem
}

export function createColorCategoryWindow(asset) {

  const { assetGroupId, colorCategory, colors, categoryNames} = asset

  // Wrapper
  let wrapperElem = document.createElement('div');
  wrapperElem.id = "color-category-window-" + assetGroupId
  wrapperElem.classList.add('color-category-window-modal', 'stats-window-modal')
  // H3
  let h3Elem = document.createElement('h3');
  h3Elem.classList.add('modal-h3')
  h3Elem.classList.add('modal-h3--stats-window')
  h3Elem.id = "color-category-window-h3-" + assetGroupId
  h3Elem.textContent = asset.name
  
  // h4
/*   let h4Elem = document.createElement('h4');
  h4Elem.classList.add('modal-h4')
  h4Elem.classList.add('modal-h4--stats-window')
  h4Elem.id = "color-category-window-h4-" + assetGroupId
  h4Elem.textContent = asset.name */

  

  // Header
  let headerElem = document.createElement('header');
  headerElem.classList.add('stats-window-modal__header')
  headerElem.appendChild(h3Elem)
  let minimizeMaximizeBtnElem = document.createElement('button')
  minimizeMaximizeBtnElem.classList.add('minus-btn')
  minimizeMaximizeBtnElem.classList.add('minus-btn--project')
  minimizeMaximizeBtnElem.id = "minus-btn-" + assetGroupId
  minimizeMaximizeBtnElem.innerHTML = `
    <i>
      <img src="img/minus-purple.svg" alt="Minimize project-modal">
    </i>
  `

  headerElem.appendChild(minimizeMaximizeBtnElem)
  wrapperElem.appendChild(headerElem)

  let hrElem = document.createElement('hr');
  hrElem.classList.add("modal-hr")
  wrapperElem.appendChild(hrElem)

  // Inner
 
  let innerElem = document.createElement('div');
  innerElem.classList.add('stats-window-modal__inner', 'project-modal__inner')
/*   innerElem.appendChild(h4Elem)
 */  let ul = document.createElement('ul');
  ul.classList.add('stats-window-modal-ul')

  for (let i = 0; i < colors.length; i++) {
    const backgroundColor = CESIUM_COLORS_DOM[colorCategory][colors[i]]
    
    const liItem = document.createElement("li")
    liItem.classList.add("stat-feature-item")
    liItem.innerHTML = `
      <div class="stat-feature-item__color" style="background-color:${backgroundColor};"></div>
      <div>${categoryNames[i]}</div>
    `

    ul.appendChild(liItem)
  }
      
    
  
  

  

  innerElem.appendChild(ul)
  wrapperElem.appendChild(innerElem)
  document.body.appendChild(wrapperElem)
  const minMaxBtnElemMounted = document.getElementById("minus-btn-" + assetGroupId)
  minMaxBtnElemMounted.addEventListener("click", handleMinMaxClick)
  if (!asset.showDefault) {
    hideShowElem(wrapperElem)
  }
  return wrapperElem
}