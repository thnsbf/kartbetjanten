import { dragElement } from "./terrain-section.js"
// Tool-modal


export function initializeSectionToolChartContainer() {



// Create the main container
const resizableChartContainer = document.createElement("div");
resizableChartContainer.id = "resizableChartContainer";
resizableChartContainer.style.display = "none";

// Create the header div
const resizableChartContainerHeader = document.createElement("div");
resizableChartContainerHeader.id = "resizableChartContainerHeader";

// Create the header title
const headerTitle = document.createElement("h2");
headerTitle.textContent = "Terrängprofil";
headerTitle.classList.add("draggable__h3")


// Append the title to the header div
resizableChartContainerHeader.appendChild(headerTitle);

// Create the close button

const btnContainer = document.createElement("div");
btnContainer.classList.add('terrain-profile__btn-container')


const closeChartButton = document.createElement("button");
closeChartButton.id = "closeChartButton";
closeChartButton.ariaLabel = "Close Terrain-profile"
closeChartButton.title = "Stäng fönster"
closeChartButton.classList.add('terrain-profile__btn')
closeChartButton.innerHTML = `
  <i>
    <img src="img/x-close-white.svg" alt="">
  </i>
`;

// Create the canvas for the chart
const terrainProfileChart = document.createElement("canvas");
terrainProfileChart.id = "terrainProfileChart";

// Create the export to Excel button
const exportToExcelButton = document.createElement("button");
exportToExcelButton.id = "exportToExcelButton";
exportToExcelButton.innerHTML = `<i>
    <img src="img/icon-excel.svg" alt="">
  </i>`;
exportToExcelButton.classList.add('terrain-profile__btn')
exportToExcelButton.classList.add('btn--excel')
exportToExcelButton.title = "Exportera resultat till Excel"


btnContainer.appendChild(exportToExcelButton)

btnContainer.appendChild(closeChartButton)


// Create a div for centering the toggle coordinates button
const buttonContainer = document.createElement("div");
buttonContainer.style.textAlign = "center";


// NEW KP - Create coordinate radio buttons

const formElem = document.createElement('form')
formElem.classList.add('terrain-coordinate-form')
formElem.id = 'terrain-coordinate-system-form'
formElem.innerHTML = `
  <label class='terrain-coordinate-label'><input type='radio' name='coordinatesystem' value='SWEREF99TM' checked />SWEREF99TM</label>
  <label class='terrain-coordinate-label'><input type='radio' name='coordinatesystem' value='WGS84' />WGS84</label>
  <label class='terrain-coordinate-label'><input type='radio' name='coordinatesystem' value='SWEREF991200' />SWEREF991200</label>
`

// Create the toggle coordinates button


// Append the toggle button to the centered div
buttonContainer.appendChild(formElem);


// Create the table
const punktlistaTable = document.createElement("table");
punktlistaTable.id = "punktlistaTable";

// Create the table header
const thead = document.createElement("thead");
const headerRow = document.createElement("tr");

const thPunktlista = document.createElement("th");
thPunktlista.textContent = "Punktlista";

const thLonLat1 = document.createElement("th");
thLonLat1.id = "headerLonLat1";
thLonLat1.textContent = "E";

const thLonLat2 = document.createElement("th");
thLonLat2.id = "headerLonLat2";
thLonLat2.textContent = "N";

const thZ = document.createElement("th");
thZ.textContent = "Z";

// Append header cells to the header row
headerRow.appendChild(thPunktlista);
headerRow.appendChild(thLonLat1);
headerRow.appendChild(thLonLat2);
headerRow.appendChild(thZ);

// Append the header row to the table header
thead.appendChild(headerRow);

// Create the table body
const tbody = document.createElement("tbody");
tbody.id = "punktlistaTableBody";

// Append the table header and body to the table
punktlistaTable.appendChild(thead);
punktlistaTable.appendChild(tbody);

// Append all elements to the main container
resizableChartContainer.appendChild(resizableChartContainerHeader);
resizableChartContainer.appendChild(btnContainer);
resizableChartContainer.appendChild(terrainProfileChart);
resizableChartContainer.appendChild(buttonContainer);
resizableChartContainer.appendChild(punktlistaTable);

// Append the entire container to the body
// Make the DIV element draggable:

document.body.appendChild(resizableChartContainer);
dragElement(document.getElementById("resizableChartContainer"));
}