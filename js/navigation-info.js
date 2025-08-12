import { updateAriaVisibility } from "./aria.js";

// Create a div for the information container
var informationContainer = document.createElement('dialog');
informationContainer.ariaLabel = "Information dialog"
informationContainer.ariaHidden = 'true'
const buttonsContainer = document.createElement('div');
buttonsContainer.id = "buttonsContainer"
buttonsContainer.classList.add("buttonsContainer")


// Add class to the information container
informationContainer.classList.add('information-container');
// Set the initial display property to 'none' to hide it by default
informationContainer.style.display = 'none';
informationContainer.id = "nav-info-dialog"

    // Create flipContainer
    let flipContainer = document.createElement('div');
    flipContainer.id = 'flipContainer';
    
    // Create flipContent
    let flipContent = document.createElement('div');
    flipContent.id = 'flipContent';
    
    // Create informationText
    let informationText = document.createElement('p');
    let informationHeader = document.createElement('h3');

    informationText.classList.add('flipText', 'modal-p');
    informationText.id = 'informationText';
    informationHeader.classList.add('flipText', 'modal-h3');
    informationHeader.id = 'informationText';
    // Här styrs texten under Information i Navigeringshjälpen
    informationText.innerHTML = 'Välkommen till <span class="text-bold">Trollhättans Stads 3D-Karta</span>. Här hittar du information om aktuella/pågående byggnadsprojekt i våran kommun. Modellen har även flera avancerade funktioner som solstudie, ritverktyg, streetview mm.<br><br> Modellen är under uppbyggnad och kommer bara att bli bättre. Vissa buggar kan förekomma. Rapportera gärna buggar till oss via mail-länken nedan.';
    informationHeader.innerHTML = '<i class="icon modal-icon"><img src="img/icon-info-purple.svg" class="img" alt="" /></i> Information'
    // Create navigationText
    let navigationHeader = document.createElement('h3');

    let navigationImage = document.createElement('img');

    navigationHeader.classList.add('flipText', 'modal-h3');
    navigationHeader.id = 'navigationText';
    navigationHeader.style.display = 'none'
    navigationHeader.innerHTML = '<i class="icon modal-icon"><img src="img/btn/icon-navigation-help.svg" class="img" alt="" /></i> Hur man navigerar';
    navigationImage.id = "navigationImage"
    navigationImage.style.display = 'none'
    navigationImage.src = "img/pek_instruk.png"
    navigationImage.classList.add('instruction-img');

// Append navigationText and informationText to flipContent
flipContent.appendChild(navigationHeader);
flipContent.appendChild(navigationImage);
flipContent.insertBefore(informationText, navigationHeader.nextSibling);
flipContent.insertBefore(informationHeader, navigationHeader.nextSibling);

// Function to check screen size and update image source
function updateImageSource() {
  const navigationImage = document.getElementById('navigationImage');
  if (window.innerWidth > 900) {
    navigationImage.src = 'img/mus_instruk.png';
  } else {
    navigationImage.src = 'img/pek_instruk.png';
  }
}

// Run the function on page load and window resize
window.addEventListener('load', updateImageSource);
window.addEventListener('resize', updateImageSource);

// Create left arrow container
var leftArrowContainer = document.createElement('button');
leftArrowContainer.ariaLabel = "Back to information"
leftArrowContainer.classList.add('modal-btn', 'btn-secondary');
leftArrowContainer.id = 'leftArrow';
leftArrowContainer.style.display = 'none'; // Initially hide
leftArrowContainer.addEventListener('click', function(){
  leftArrowContainer.style.display = 'none';
  rightArrowContainer.style.display = 'block flex';
  navigationText.style.display = 'none';
  informationText.style.display = 'block';
  informationHeader.style.display = 'block flex';
  navigationImage.style.display = 'none'

})
// Create left arrow icon
var leftArrowIcon = document.createElement('i');
leftArrowIcon.classList.add('modal-btn__icon');
leftArrowIcon.innerHTML = '<img style="transform: rotate(90deg); height: 12px; width: 12px;" src="img/icon-kommun-arrow-purple.svg">'

// Append left arrow icon to left arrow container
leftArrowContainer.textContent = 'Bakåt'; // Arrow symbol
leftArrowContainer.appendChild(leftArrowIcon);

// Create right arrow container
const rightArrowContainer = document.createElement('button');
rightArrowContainer.ariaLabel = "Navigation help"

rightArrowContainer.classList.add('modal-btn', 'btn-secondary');
rightArrowContainer.id = 'rightArrow';
rightArrowContainer.style.display = 'block flex'; // Initially hide
rightArrowContainer.addEventListener('click', function() {
  rightArrowContainer.style.display = 'none';
  leftArrowContainer.style.display = 'block flex';  
  navigationText.style.display = 'block flex';
  informationText.style.display = 'none';
  informationHeader.style.display = 'none';
  navigationImage.style.display = 'block'
})
// Create right arrow icon
const rightArrowIcon = document.createElement('i');
rightArrowIcon.classList.add('modal-btn__icon')
rightArrowIcon.innerHTML = '<img src="img/btn/icon-navigation-help.svg">'
rightArrowContainer.appendChild(rightArrowIcon)
rightArrowContainer.textContent = 'Navigeringshjälp'; // Arrow symbol


// Append
rightArrowContainer.appendChild(rightArrowIcon);
flipContainer.appendChild(flipContent);
buttonsContainer.appendChild(leftArrowContainer);
buttonsContainer.appendChild(rightArrowContainer);

// Append the close button to the information container
informationContainer.appendChild(flipContainer);
informationContainer.appendChild(buttonsContainer);

// Create a close button
const informationCloseButton = document.createElement('button');
const informationCloseButtonIcon = document.createElement('i');
informationCloseButtonIcon.classList.add('modal-btn__icon')
informationCloseButtonIcon.innerHTML = '<img src="img/btn/icon-close.svg">'
informationCloseButton.textContent = 'Stäng';
informationCloseButton.appendChild(informationCloseButtonIcon)
informationCloseButton.ariaLabel = 'Close info-dialog'


// Add class to the close button
informationCloseButton.classList.add('modal-btn', 'btn-primary');
const informationXbtn = document.createElement('button');
informationXbtn.ariaLabel = 'Close info-dialog'
informationXbtn.classList.add('x-btn');
informationXbtn.innerHTML = '<img src="img/x-close.svg">'
informationContainer.appendChild(informationXbtn)

function closeNavInfo() {
  informationContainer.style.display = 'none'; // Hide the information container
  overlay.style.display = 'none'; //Hide the overlay
  updateAriaVisibility(informationContainer.id, true)

}

// Add event listener to close the information popup when the close button is clicked
informationCloseButton.addEventListener('click', closeNavInfo);
informationXbtn.addEventListener('click', closeNavInfo);
// Append the close button to the information container
buttonsContainer.appendChild(informationCloseButton);
// Append the information container to the document body
document.body.appendChild(informationContainer);
// Create the overlay
var overlay = document.createElement('div');
overlay.classList.add('overlay');
overlay.style.display = 'none'; // Initially hide

// Append the overlay to the document body
document.body.appendChild(overlay);
// Find the NavigationInfoBtn button
const navigationInfoBtn = document.getElementById('navigation-help-Btn');
const navigationInfoBtnMobile = document.getElementById('mobile-navbar-info-btn');

function openCloseNavInfo() {
  overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';

  // Toggle the display of the information container
  informationContainer.style.display = informationContainer.style.display === 'none' ? 'block' : 'none';

}

// Add event listener to toggle the display of the overlay and information container when the NavigationInfoBtn is clicked
navigationInfoBtnMobile.addEventListener('click', function() {
  const trueOrFalse = overlay.style.display === 'block' ? 'false' : 'true';

  // Toggle the display of the overlay
  openCloseNavInfo()
  updateAriaVisibility("nav-info-dialog", trueOrFalse)
});
navigationInfoBtn.addEventListener('click', function() {
  const trueOrFalse = overlay.style.display === 'block' ? 'false' : 'true';

  // Toggle the display of the overlay
  openCloseNavInfo()
  updateAriaVisibility("nav-info-dialog", trueOrFalse)
});