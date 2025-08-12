


export function startLoadingSpinner() {
  const wrapper = document.createElement("div")
  wrapper.classList.add("spinner-wrapper")
  const spinner = document.createElement("div")
  spinner.classList.add("spinner")
  wrapper.appendChild(spinner)
  document.body.appendChild(wrapper)
  return wrapper
}

export function removeLoadingSpinner(spinner) {
  spinner.remove()
}