// Attach draggable functionality to all divs with the 'draggable' class
import { updateAriaVisibility } from "./aria.js";

const draggableDivs = document.querySelectorAll('.draggable');

draggableDivs.forEach((div) => {
  const dragBar = div.querySelector('.drag-bar');  // Get the bar for dragging
  dragElement(div, dragBar);  // Pass the div and its bar

  // Add close button functionality
  const closeBtn = div.querySelector('.close-btn');
  closeBtn.onclick = () => {
    div.style.display = 'none';  // Hide the div
    updateAriaVisibility(div.id, 'true')
  };

  // Initialize Tippy on the drag-bar
  tippy(dragBar, {
    content: "Dra för att flytta",   // Tooltip text
    placement: 'top',          // Tooltip placement
    arrow: true,               // Show an arrow
    delay: [100, 0],           // Delay before showing and hiding
    theme: 'light-border',     // Optional theme for styling
  });
});

// Function to drag the divs
function dragElement(element, dragHandle) {
  var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  dragHandle.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;

    // Calculate new position
    let newTop = element.offsetTop - pos2;
    let newLeft = element.offsetLeft - pos1;

    // Get viewport dimensions
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Prevent dragging outside the viewport
    if (newTop < 0) newTop = 0;  // Top boundary
    if (newLeft < 0) newLeft = 0; // Left boundary
    if (newTop + element.offsetHeight > viewportHeight) {
      newTop = viewportHeight - element.offsetHeight; // Bottom boundary
    }
    if (newLeft + element.offsetWidth > viewportWidth) {
      newLeft = viewportWidth - element.offsetWidth; // Right boundary
    }

    // Set the new position
    element.style.top = newTop + "px";
    element.style.left = newLeft + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// Button handlers to show corresponding divs
document.getElementById('showDiv1').addEventListener('click', () => {
  document.getElementById('draggableDiv1').style.display = 'block';
  updateAriaVisibility('draggableDiv1', 'false')
});

document.getElementById('showDiv2').addEventListener('click', () => {
  document.getElementById('draggableDiv2').style.display = 'block';
  updateAriaVisibility('draggableDiv2', 'false')

});

document.getElementById('showDiv3').addEventListener('click', () => {
  document.getElementById('draggableDiv3').style.display = 'block';
  updateAriaVisibility('draggableDiv3', 'false')

});

document.getElementById('showDiv4').addEventListener('click', () => {
  document.getElementById('draggableDiv4').style.display = 'block';
  updateAriaVisibility('draggableDiv4', 'false')
});

document.getElementById('showDiv6').addEventListener('click', () => {
  document.getElementById('draggableDiv6').style.display = 'block';
  updateAriaVisibility('draggableDiv6', 'false')
});