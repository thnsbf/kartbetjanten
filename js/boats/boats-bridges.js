const mockData = {
    stridsbergsbron: {
      bridgeName: "stridsbergsbron",
      currentWarnings: []
    },
    jarnvagsbron: {
      bridgeName: "jarnvagsbron",
      currentWarnings: []
    },
    klaffbron: {
      bridgeName: "klaffbron",
      currentWarnings: [
        {mmsi: 123441, riskLevel: 2, time: { low: 10, high: 15 }}
      ]
    },
    olidebron: {
      bridgeName: "olidebron",
      currentWarnings: [
        {mmsi: 123441, riskLevel: 3, time: { low: 0, high: 5 }}
      ]
    }
  }

const RISK_CODEX = {
    1: {text: "LITEN", color: "#55C84D"},
    2: {text: "MELLANSTOR", color: "#F9AE2C"},
    3: {text: "STOR", color: "#E04343"}
  }



export function createBridgesElem(data) {

  const currentElem = document.getElementById('bridges-wrapper')
  if (currentElem) currentElem.remove()

  const { stridsbergsbron, jarnvagsbron, klaffbron, olidebron } = data
  console.log("bridge data from API: ")
  console.log(data)


  const stridsbergsrisk = stridsbergsbron.currentWarnings.length === 0 ? 1 : stridsbergsbron.currentWarnings[0].riskLevel ?? 3
  const jarnvagsrisk = jarnvagsbron.currentWarnings.length === 0 ? 1 : jarnvagsbron.currentWarnings[0].riskLevel ?? 3
  const klaffrisk = klaffbron.currentWarnings.length === 0 ? 1 : klaffbron.currentWarnings[0].riskLevel ?? 3
  const oliderisk = olidebron.currentWarnings.length === 0 ? 1 : olidebron.currentWarnings[0].riskLevel ?? 3
  const stridsbergNearestWarning = stridsbergsrisk > 1 ? stridsbergsbron.currentWarnings[0] : null
  const jarnvagNearestWarning = jarnvagsrisk > 1 ? jarnvagsbron.currentWarnings[0] : null
  const klaffNearestWarning = klaffrisk > 1 ? klaffbron.currentWarnings[0] : null
  const olideNearestWarning = oliderisk > 1 ? olidebron.currentWarnings[0] : null

  
  const iconUrl = '/img/bridge-white.svg'
  const bridgesWrapperElem = document.createElement("div")
  bridgesWrapperElem.id = "bridges-wrapper"
  bridgesWrapperElem.classList.add("bridges-wrapper-elem")
  bridgesWrapperElem.innerHTML = `
          
  <header class='bridges__header'>
    <i>
      <img src='${iconUrl}' class='bridge-icon' />
    </i>
    Broöppningar Live
    <button id='close-btn--bridges' class='close-btn close-btn--bridges' aria-label="Close modal - Bridge openings" title="Stäng">
      <i>
        <img src="img/x-close-white.svg" alt="">
      </i>
    </button>
  </header>
  <div class='bridges__main'>
    <ul class='bridges__list'>
      <li class='bridges__list-item'>
        <h2 class='bridge-h2 bridge-text bridge-text--big'>STRIDSBERGSBRON</h2>
        <div class='bridge-info-box'>
          <div class='info-box__top-level'>
            <label for='stridsbergsbron-risk' class='bridge-text bridge-text--small'>Sannolikhet för öppning</label>
            <label for='stridsbergsbron-starttime' class='bridge-text bridge-text--small'>Börjar om</label>
          </div>
          <hr class='bridge-info-hr' />
          <div class='info-box__bottom-level'>
            <div style='display: flex; gap: 8px;'>
              <div class='bridge-circle' style='background: ${RISK_CODEX[stridsbergsrisk].color};'></div>
              <div id='stridsbergsbron-risk' class='bridge-text bridge-text--big'>${RISK_CODEX[stridsbergsrisk].text}</div>
            </div>
            <div id='stridsbergsbron-starttime' class='bridge-text bridge-text--starttime bridge-text--big'>${stridsbergNearestWarning ? stridsbergNearestWarning.time.low + "-" + stridsbergNearestWarning.time.high + " min" : "-"}</div>
          </div>
        </div>
      </li>
      <li class='bridges__list-item'>
        <h2 class='bridge-h2 bridge-text bridge-text--big'>JÄRNVÄGSBRON</h2>
        <div class='bridge-info-box'>
          <div class='info-box__top-level'>
            <label for='jarnvagsbron-risk' class='bridge-text bridge-text--small'>Sannolikhet för öppning</label>
            <label for='jarnvagsbron-starttime' class='bridge-text bridge-text--small'>Börjar om</label>
          </div>
          <hr class='bridge-info-hr' />
          <div class='info-box__bottom-level'>
            <div style='display: flex; gap: 8px;'>
              <div class='bridge-circle' style='background: ${RISK_CODEX[jarnvagsrisk].color};'></div>
              <div id='jarnvagsbron-risk' class='bridge-text bridge-text--big'>${RISK_CODEX[jarnvagsrisk].text}</div>
            </div>
            <div id='jarnvagsbron-starttime' class='bridge-text bridge-text--starttime bridge-text--big'>${jarnvagNearestWarning ? jarnvagNearestWarning.time.low + "-" + jarnvagNearestWarning.time.high + " min" : "-"}</div>
          </div>
        </div>
      </li>
      <li class='bridges__list-item'>
        <h2 class='bridge-h2 bridge-text bridge-text--big'>KLAFFBRON</h2>
        <div class='bridge-info-box'>
          <div class='info-box__top-level'>
            <label for='klaffbron-risk' class='bridge-text bridge-text--small'>Sannolikhet för öppning</label>
            <label for='klaffbron-starttime' class='bridge-text bridge-text--small'>Börjar om</label>
          </div>
          <hr class='bridge-info-hr' />
          <div class='info-box__bottom-level'>
            <div style='display: flex; gap: 8px;'>
              <div class='bridge-circle' style='background: ${RISK_CODEX[klaffrisk].color};'></div>
              <div id='klaffbron-risk' class='bridge-text bridge-text--big'>${RISK_CODEX[klaffrisk].text}</div>
            </div>
            <div id='klaffbron-starttime' class='bridge-text bridge-text--starttime bridge-text--big'>${klaffNearestWarning ? klaffNearestWarning.time.low + "-" + klaffNearestWarning.time.high + " min" : "-"}</div>
          </div>
        </div>
      </li>
      <li class='bridges__list-item'>
        <h2 class='bridge-h2 bridge-text bridge-text--big'>OLIDEBRON</h2>
        <div class='bridge-info-box'>
          <div class='info-box__top-level'>
            <label for='olidebron-risk' class='bridge-text bridge-text--small'>Sannolikhet för öppning</label>
            <label for='olidebron-starttime' class='bridge-text bridge-text--small'>Börjar om</label>
          </div>
          <hr class='bridge-info-hr' />
          <div class='info-box__bottom-level'>
            <div style='display: flex; gap: 8px;'>
              <div class='bridge-circle' style='background: ${RISK_CODEX[oliderisk].color};'></div>
              <div id='olidebron-risk' class='bridge-text bridge-text--big'>${RISK_CODEX[oliderisk].text}</div>
            </div>
            <div id='olidebron-starttime' class='bridge-text bridge-text--starttime bridge-text--big'>${olideNearestWarning ? olideNearestWarning.time.low + "-" + olideNearestWarning.time.high + " min" : "-"}</div>
          </div>
        </div>
      </li>
    </ul>
  </div>
  `
  document.body.appendChild(bridgesWrapperElem)
  const mountedBtn = document.getElementById('close-btn--bridges')
  mountedBtn.addEventListener('click', handleClose)
}

function handleClose() {
  const mountedBtn = document.getElementById('close-btn--bridges')
  mountedBtn.removeEventListener('click', handleClose)
  const currentElem = document.getElementById('bridges-wrapper')
  currentElem.remove()
  const checkbox = document.getElementById("view-checkbox-brooppningar")
  checkbox.dispatchEvent(new Event('change'))
  checkbox.checked = false
}