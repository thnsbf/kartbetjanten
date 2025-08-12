  import { viewer } from "./viewer.js";
  import { CESIUM_COLORS } from "./colors/colors.js";
  proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs +type=crs");
  proj4.defs("EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs");
  proj4.defs("EPSG:3007", "+proj=tmerc +lat_0=0 +lon_0=12 +k=1 +x_0=150000 +y_0=0 +ellps=GRS80 +units=m +no_defs");


  let drawing = false;
  let positions = [];
  let lineLength;
  let coordinateSystem = "SWEREF99TM"; // Move the declaration here
  let activeEntities = []
  
  export function drawLine() {
    drawing = true;
    positions = [];
    let clickCount = 0; // Variable to track the number of clicks
  
    const drawButton = document.getElementById("drawLineButton");
    const originalText = drawButton.innerHTML; // Store original text
    drawButton.innerHTML = "Välj punkt 1"; // Set initial text
    drawButton.disabled = true

   /*  const terrainProfileBtn = document.getElementById('top-left-button5');
    console.log(terrainProfileBtn)
    terrainProfileBtn.style.backgroundColor = '#7dffb5'; // Hide the button */

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  
    handler.setInputAction((click) => {
      clickCount++;
  
      const ray = viewer.camera.getPickRay(click.position);
      const position = viewer.scene.globe.pick(ray, viewer.scene);
  
      if (position) {
        positions.push(position);
        const pos1 = viewer.entities.add({
          position: position,
          point: {
            pixelSize: 5,
            color: CESIUM_COLORS.KOMMUN.MAIN,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          },
        });
        activeEntities.push(pos1)
  
        // Draw a line draped on the ground
        if (positions.length > 1) {
          const polyline = viewer.entities.add({
            polyline: {
              positions: positions,
              width: 4,
              material: CESIUM_COLORS.KOMMUN.LIGHTER,
              clampToGround: true,
            },
          });
          activeEntities.push(polyline)
        }
        if (clickCount === 1) {
          drawButton.innerHTML = "Välj punkt 2"; // Update text after first click
        }
        // Check if it's the second click
        if (clickCount === 2) {
          // Stop drawing after the second click
          drawButton.innerHTML = originalText; // Reset to original after second click
          /* terrainProfileBtn.style.backgroundColor = "#fff" */
             // Update the button text to show the current coordinate system
          drawing = false;
          lineLength = calculateDistance(positions);
          handler.destroy();
          drawButton.disabled = false
          
          // Call the function to create the terrain profile
          createTerrainProfile();
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  
    handler.setInputAction(() => {
      // Stop drawing after the second click
      if (clickCount === 2) {
        drawing = false;
        lineLength = calculateDistance(positions);
        handler.destroy();
  
        // Call the function to create the terrain profile
        createTerrainProfile();
      }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  }
  
  
  function calculateDistance(positions) {
    let distance = 0;
    for (let i = 1; i < positions.length; i++) {
      distance += Cesium.Cartesian3.distance(positions[i], positions[i - 1]);
    }
    return distance;
  }
  
  // Function to create a new object with SWEREF 99 TM coordinates and terrain height
  function createSWEREF99TMWithZ(sweref99TM, terrainHeight) {
    return {
      x: sweref99TM[0],
      y: sweref99TM[1],
      z: terrainHeight,
    };
  }
  // Function to export the table to Excel
  function exportToExcel() {
    // Get the table body
    const tableBody = document.getElementById('punktlistaTableBody');
   // Extract data from the table
   const tableData = Array.from(tableBody.rows).map(row => {
    let rowData = {
      E: parseFloat(row.cells[1].innerText),
      N: parseFloat(row.cells[2].innerText),
      Z: parseFloat(row.cells[3].innerText),
    };
  
    // Check the coordinate system and update column headers
    if (coordinateSystem === "WGS84") {
      rowData = {
        Lon: rowData.E,
        Lat: rowData.N,
        Z: rowData.Z,
      };
    }
  
    return rowData;
  });
  
    // Create a new worksheet
    const ws = XLSX.utils.json_to_sheet(tableData);
  
    // Create a new workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Terrain_Profile_Data");
  
    // Save the workbook as an Excel file
    XLSX.writeFile(wb, "terrain_profile_data.xlsx");
  }
  
  
  
  
  function createTerrainProfile() {
    if (positions.length < 2) {
      alert("Please draw a line on the terrain first.");
      return;
    }
  
    // Sample points between the start and end points
    // Read the number of samples from the input
    const numberOfSamplesInput = document.getElementById('numberOfSamples');
    const numberOfSamples = parseInt(numberOfSamplesInput.value, 10);
   // const numberOfSamples = 4;
    const sampledPositions = [];
    const distances = [0];
    let totalDistance = 0;
  
    // Sample terrain heights for the positions along the line
    const terrainPromise = Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions);
  
    terrainPromise
      .then(() => {
        for (let i = 0; i < numberOfSamples; i++) {
          const t = i / (numberOfSamples - 1);
  
          const interpolatedPosition = Cesium.Cartesian3.lerp(
            positions[0],
            positions[positions.length - 1],
            t,
            new Cesium.Cartesian3()
          );
  
          // Convert Cartesian3 to Cartographic without specifying the height
          const cartographic = Cesium.Cartographic.fromCartesian(interpolatedPosition);
  
          // Extract longitude and latitude in degrees from Cartographic coordinates
          const sourceCoord = [Cesium.Math.toDegrees(cartographic.longitude), Cesium.Math.toDegrees(cartographic.latitude)];
  
          // Perform the coordinate transformation from WGS84 to SWEREF 99 TM
          const sweref99TM = proj4("EPSG:4326", "EPSG:3006", sourceCoord);
  
          // Get the terrain height at the interpolated x and y positions
          const terrainHeight = viewer.scene.globe.getHeight(cartographic);
  
          // Create a new object with SWEREF 99 TM coordinates and terrain height
          const sweref99TMwithZ = createSWEREF99TMWithZ(sweref99TM, terrainHeight);
  
          sampledPositions.push(sweref99TMwithZ);
  
          if (i > 0) {
            const distance = Cesium.Cartesian3.distance(
              sampledPositions[i],
              sampledPositions[i - 1]
            );
            totalDistance += distance;
            distances.push(totalDistance);
          }
        }
  // Destroy the existing chart if it exists
  const existingChart = Chart.getChart("terrainProfileChart");
  if (existingChart) {
    existingChart.destroy();
  }
        // Create the chart with the correct heights
        new Chart(document.getElementById("terrainProfileChart"), {
          type: "line",
          data: {
            labels: distances,
            datasets: [
              {
                label: "Terrängprofil",
                data: sampledPositions.map(position => position.z), // Use the z component as the height
                borderColor: "rgba(25, 200, 150, 1)",
                borderWidth: 2,
                fill: false,
              },
            ],
          },
          options: {
            scales: {
              x: {
                type: "linear",
                position: "bottom",
                title: {
                  display: true,
                  text: "Distans längs terrängprofilen (m)",
                },
              },
              y: {
                type: "linear",
                position: "left",
                title: {
                  display: true,
                  text: "Höjd (m)",
                },
              },
            },
            onHover: (_, chartElement) => {
              // Check if the mouse is over a point on the chart
              if (chartElement.length > 0) {
                const index = chartElement[0].index;
  
                // Get the corresponding Cartesian position
                const cartesianPosition = sampledPositions[index];
  
                // Add a temporary point on the Cesium map
                const tempPoint = viewer.entities.add({
                  position: cartesianPosition,
                  point: {
                    pixelSize: 8,
                    color: Cesium.Color.RED,
                  },
                });
  
                // Remove the temporary point after a short delay
                setTimeout(() => {
                  viewer.entities.remove(tempPoint);
                }, 1000);
              }
            },
          },
        });
  
        // Create the table dynamically
        const tableBody = document.getElementById('punktlistaTableBody');
        tableBody.innerHTML = ''; // Clear existing rows
  
        sampledPositions.forEach((position, index) => {
          const row = tableBody.insertRow();
          row.insertCell(0).innerText = `P${index + 1}`;
          row.insertCell(1).innerText = position.x.toFixed(3);
          row.insertCell(2).innerText = position.y.toFixed(3);
          row.insertCell(3).innerText = position.z.toFixed(3);
        });
        // Add a variable to track the current coordinate system
  // Add a variable to track the current coordinate system
  let coordinateSystem = "SWEREF99TM";
  // Ensure we do not add multiple event listeners
  
  // Function to update the table coordinates based on the current coordinate system
  function updateTableCoordinates() {
    const tableBody = document.getElementById("punktlistaTableBody");
    tableBody.innerHTML = ''; // Clear existing rows
  
    sampledPositions.forEach((position, index) => {
      const row = tableBody.insertRow();
      row.insertCell(0).innerText = `P${index + 1}`;
  let header1 = document.getElementById('headerLonLat1');
  let header2 = document.getElementById('headerLonLat2');
      let x, y;
      if (coordinateSystem === "SWEREF99TM") {
        x = position.x.toFixed(3);
        y = position.y.toFixed(3); 
      header1.textContent = 'E';
      header2.textContent = 'N';
      } else if (coordinateSystem === "SWEREF991200") {
        // Perform the transformation from SWEREF99TM to SWEREF99 16 30
        const sweref991200Coord = proj4("EPSG:3006", "EPSG:3007", [position.x, position.y]);
        x = sweref991200Coord[0].toFixed(3);
        y = sweref991200Coord[1].toFixed(3); 
      header1.textContent = 'E';
      header2.textContent = 'N';
      } else {
        // Perform the reverse coordinate transformation from SWEREF99TM to WGS84
        const wgs84Coord = proj4("EPSG:3006", "EPSG:4326", [position.x, position.y]);
        x = wgs84Coord[0].toFixed(3);
        y = wgs84Coord[1].toFixed(3);
      header1.textContent = 'Lon';
      header2.textContent = 'Lat';
      }
  
      row.insertCell(1).innerText = x;
      row.insertCell(2).innerText = y;
      row.insertCell(3).innerText = position.z.toFixed(3);
    });
  }
  
  
  function handleTerrainProfileCoordinateSystemChange(e) {
    coordinateSystem = e.target.value
    updateTableCoordinates();
  }

  document.getElementById('terrain-coordinate-system-form').addEventListener('change', handleTerrainProfileCoordinateSystemChange)

  
  
  
  
    // Show the chart container after creating the terrain profile
    const chartContainer = document.getElementById("resizableChartContainer");
    chartContainer.style.display = "block flex";
  
    // Attach a click event listener to the "Close Chart" button
    document.getElementById("closeChartButton").addEventListener("click", () => {
      // Hide the chart container when the button is clicked
      chartContainer.style.display = "none";
      document.getElementById('terrain-coordinate-system-form').removeEventListener('change', handleTerrainProfileCoordinateSystemChange)
      activeEntities.forEach(entity => {
        viewer.entities.remove(entity)
      })
      activeEntities = []

    });
        // Event listener for the "Export to Excel" button
        document.getElementById("exportToExcelButton").addEventListener("click", () => {
          exportToExcel(sampledPositions);
        });
      })
  
      .catch((error) => {
        console.error("Error sampling terrain:", error);
      });
  }
  
  
  
  export function dragElement(elmnt) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    // Check if the element has a header for dragging
    if (document.getElementById(elmnt.id + "Header")) {
      // If present, the header is where you move the DIV from
      document.getElementById(elmnt.id + "Header").onmousedown = dragMouseDown;
    } else {
      // Otherwise, move the DIV from anywhere inside the DIV
      elmnt.onmousedown = dragMouseDown;
    }
  
    // Function to handle dragging
    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
  
      // If the click is on the header, allow dragging
      if (e.target.id.endsWith("Header")|| e.target.tagName.toLowerCase() === 'h2') {
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
      }
    }
  
    // Function to handle dragging the element
    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
      elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }
  
    // Function to handle closing drag element
    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }
  
  
  // Event listeners for buttons

  
  
  