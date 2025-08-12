import { viewer } from "./viewer.js";


export function initializeSunModule() {



// Reference to the button for updating its text
var shadowToggleBtn = document.getElementById('sun-study-btn');
// Function to update Cesium time and shadows based on slider values
// Put at top to make it globally availble
function updateCesiumTimeAndShadows(month, day, time) {
    // Create a JavaScript Date object with the slider values
    var date = new Date(new Date().getFullYear(), month - 1, day, time, 0, 0);
  
    // Set Cesium clock to the desired time
    viewer.clock.currentTime = Cesium.JulianDate.fromDate(date);
  
 updateShadowButtonText();
   
  }

  // Function to update the button text based on the shadow state
function updateShadowButtonText() {
    if (viewer.shadows) {
        shadowToggleBtn.innerHTML = '<i><img src="img/btn/icon-close.svg" alt=""></i>Avaktivera skuggor';
        shadowToggleBtn.ariaLabel = 'Deactivate shadows'
    } else {
        shadowToggleBtn.innerHTML = '<i><img src="img/btn/icon-sun.svg" alt=""></i>Aktivera skuggor';
        shadowToggleBtn.ariaLabel = 'Activate shadows'
    }
}

 // Set the initial button text on page load
 updateShadowButtonText();
 // Add event listener to toggle shadows on button click
 shadowToggleBtn.addEventListener('click', function() {
     // Toggle the current state of shadows
  viewer.shadows = !viewer.shadows;
  if (viewer.shadows) {
    var month = parseInt(document.querySelector('.month-slider-class').value);
    var day = parseInt(document.querySelector('.date-slider-class').value);
    var time = parseFloat(document.querySelector('.time-slider-class').value);
    updateCesiumTimeAndShadows(month, day, time)
  } else {
  // Update the button text after toggling
    updateShadowButtonText();
  }
     
 });
var rangeSliderMonth = document.getElementById('month-slider');
var sunMonthTextOutput = document.getElementById('month-slider-value');
var rangeSliderDay = document.getElementById('date-slider');
var sunDayTextOutput = document.getElementById('date-slider-value');
var rangeSliderTime = document.getElementById('time-slider');
var sunTimeTextOutput = document.getElementById('time-slider-value');
  // Add event listener to update Cesium time and shadows when slider value changes
  rangeSliderMonth.addEventListener('input', function() {
    var month = parseInt(this.value);
    var day = parseInt(document.querySelector('.date-slider-class').value);
    var time = parseFloat(document.querySelector('.time-slider-class').value);
    updateCesiumTimeAndShadows(month, day, time);
    
    // Update output text for month
    var monthIndex = parseInt(this.value) - 1;
    var months = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
    sunMonthTextOutput.textContent = months[monthIndex];
    
    // Update the maximum value and output text for day slider based on the selected month
    var daysInMonth = new Date(new Date().getFullYear(), month, 0).getDate();
    var currentDay = parseInt(document.querySelector('.date-slider-class').value);
    if (currentDay > daysInMonth) {
      rangeSliderDay.max = daysInMonth.toString();
      rangeSliderDay.value = daysInMonth.toString();
      sunDayTextOutput.textContent = daysInMonth;
    } else {
      rangeSliderDay.max = daysInMonth.toString();
    }
  });
    // Add event listener to update Cesium time and shadows when slider value changes
  rangeSliderDay.addEventListener('input', function() {
    var month = parseInt(document.querySelector('.month-slider-class').value);
    var day = parseInt(this.value);
    var time = parseFloat(document.querySelector('.time-slider-class').value);
    updateCesiumTimeAndShadows(month, day, time);
    
    // Update output text for day
    sunDayTextOutput.textContent = this.value;
  });

  
  // Add event listener to update Cesium time and shadows when slider value changes
  rangeSliderTime.addEventListener('input', function() {
    var month = parseInt(document.querySelector('.month-slider-class').value);
    var day = parseInt(document.querySelector('.date-slider-class').value);
    var time = parseFloat(this.value);
    updateCesiumTimeAndShadows(month, day, time);
    
    // Update output text for time
    var hours = Math.floor(this.value);
    var minutes = (this.value - hours) * 60;
    var timeString = ('0' + hours).slice(-2) + ':' + ('0' + minutes).slice(-2);
    sunTimeTextOutput.textContent = timeString;
  });
}