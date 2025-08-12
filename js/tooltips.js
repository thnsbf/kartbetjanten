
export function toggleTooltip(elemId) {
  const elem = document.getElementById(elemId)
  const btn = document.getElementById(elemId + "-btn")
  if (elem.style.display === 'block') {
    elem.style.display = 'none'
    elem.style.visibility = 'hidden'
    elem.ariaHidden = true
    btn.style.backgroundColor = "unset"
  } else {
    elem.style.display = 'block'
    elem.style.visibility = 'visible'
    elem.ariaHidden = false
    btn.style.backgroundColor = "var(--kommunfarg-lighter)"
  }
}