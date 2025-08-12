

export const updateAriaVisibility = (elementId, trueOrFalse) => {
  const elem = document.getElementById(elementId)
  elem.setAttribute('aria-hidden', trueOrFalse);
};

