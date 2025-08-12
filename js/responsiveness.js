export const responsiveAriaVisibility = () => {
  const elemHamburger = document.getElementById('checkbox-hamburger');
  const elemInfoBtnMobile = document.getElementById('mobile-navbar-info-btn');

      if (window.innerWidth <= 800) {
          elemHamburger.setAttribute('aria-hidden', 'false');
          elemInfoBtnMobile.setAttribute('aria-hidden', 'false');
      } else {
          elemHamburger.setAttribute('aria-hidden', 'true');
          elemInfoBtnMobile.setAttribute('aria-hidden', 'true');
      }
}