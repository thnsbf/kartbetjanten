const elementsThatUseBlock = [
  "stats-window-modal",
  "info-window-modal",
  "color-category-window-modal stats-window-modal"
]

export function hideShowElem(elem) {
  if (elem.ariaHidden) {
    elem.ariaHidden = null
    elem.style.display = elementsThatUseBlock.includes(elem.className)  ? "block" : "block flex"
    elem.style.visibility = "visible"

  } else {
    elem.ariaHidden = true
    elem.style.display = "none"
    elem.style.visibility = "hidden"
  }

}

