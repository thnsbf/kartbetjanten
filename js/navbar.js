  // search-box open close js code
  let navbar = document.querySelector(".navbar");
  let searchBox = document.querySelector(".search-box .bx-search");
  // let searchBoxCancel = document.querySelector(".search-box .bx-x");
  
  // sidebar open close js code
  let navLinks = document.querySelector(".nav-links");
  const elemCloseNavMobileBtn = document.getElementById("close-nav-mobile-btn");
  const elemHamburgerCheckbox = document.getElementById("checkbox-hamburger");
  
  elemCloseNavMobileBtn.addEventListener("click", () => {
    elemHamburgerCheckbox.checked = false
  })

  const navLinkItems = document.getElementsByClassName("nav-link-item")
  const dropdowns = []
  for (let i = 0; i < navLinkItems.length; i++) {
    const subMenuItems =  navLinkItems[i].getElementsByClassName("sub-menu")
    if (subMenuItems.length) {
      dropdowns.push(subMenuItems[0])
    }
  }
  for (const subMenuItem of dropdowns) {
    subMenuItem.addEventListener('mouseenter', (e) => showMenu(e));
    subMenuItem.addEventListener('mouseleave', (e) => hideMenuWithDelay(e));
  }

  let hideTimeout

  function showMenu(e) {
    const subMenuItem = e.target
    clearTimeout(hideTimeout)
    subMenuItem.classList.add("navbar-sub-menu-show")
  }

  function hideMenuWithDelay(e) {
    const subMenuItem = e.target
    hideTimeout = setTimeout(() => {
      subMenuItem.classList.remove('navbar-sub-menu-show');
    }, 550); // Adjust the delay (in ms) here
  }

  
  

  // sidebar submenu open close js code
  // hänger ihop med css kod
  const elemVerktygNavA = document.querySelector("#verktyg-nav-a");
  elemVerktygNavA.onclick = function() {
   navLinks.classList.toggle("show1");
  }
  const elemProjektNavA = document.querySelector("#projekt-nav-a");
  elemProjektNavA.onclick = function() {
   navLinks.classList.toggle("show3");
  }
  const elemBakgrundskartorNavA = document.querySelector("#bakgrundskartor-nav-a");
  elemBakgrundskartorNavA.onclick = function() {
   navLinks.classList.toggle("show6");
  }
  let zoomLocation1Arrow = document.querySelector(".zoomLocation1-arrow");
  if (zoomLocation1Arrow) {
    zoomLocation1Arrow.onclick = function() {
      navLinks.classList.toggle("show7");
     }
  }
  
  let zoomLocation2Arrow = document.querySelector(".zoomLocation2-arrow");
  if (zoomLocation2Arrow) {
    zoomLocation2Arrow.onclick = function() {
      navLinks.classList.toggle("show8");
     }
  }
  let zoomLocation3Arrow = document.querySelector(".zoomLocation3-arrow");
  if (zoomLocation3Arrow) {
    zoomLocation3Arrow.onclick = function() {
      navLinks.classList.toggle("show7");
     }
  }
 