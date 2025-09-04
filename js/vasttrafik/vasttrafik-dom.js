import { getResource } from './vasttrafik-api.js'

let timeUntilNextStation = null
let selectedJourney = null

function getSelectedJourney() {
  return selectedJourney
}

export async function showJourneyInfo(journey) {
  console.log(journey)
  removeExistingJourneyInfoElem()

  selectedJourney = journey.ref

  const vehicleType = journey.vehicleType
  const shortDirection = journey.directionDetails.shortDirection
  const fullDirection = journey.directionDetails.fullDirection
  const { backgroundColor, foregroundColor, borderColor, name, transportMode } = journey.line
  const iconUrl = `../../img/icon-vt-${transportMode}.svg`
  const frontEntry = fullDirection.slice(-17) === ', Påstigning fram' ? ', Påstigning fram' : ''
  const detailsUrl = `/journeys/${journey.ref}/details`

  const details = await getResource(detailsUrl)
  const now = new Date().getTime()
  
  const stops = details.tripLegs[0].callsOnTripLeg
  let zoomStop = false

  let tripStopItems = stops.map((tripStop, index) => {

    const {
      estimatedArrivalTime,
      estimatedDepartureTime,
      estimatedOtherwisePlannedArrivalTime,
      estimatedOtherwisePlannedDepartureTime,
      plannedArrivalTime, 
      plannedDepartureTime, 
      plannedPlatform,
      longitude, 
      latitude,
      isTripLegStart,
      isTripLegStop,
      stopPoint,
      tariffZones,
      isOnTripLeg
    } = tripStop

    if (!isOnTripLeg) return ""
    let firstStopThatIsAlreadyPassed = false
    const timeComparison = new Date(estimatedOtherwisePlannedDepartureTime || estimatedOtherwisePlannedArrivalTime).getTime()
    const alreadyPassed = now > timeComparison
    if (!alreadyPassed && !zoomStop) {
      firstStopThatIsAlreadyPassed = true
      zoomStop = true
      timeUntilNextStation = timeComparison - now
      setTimeout(() => {
        const j = getSelectedJourney()
        if (j === journey.ref) showJourneyInfo(journey)
      }, timeUntilNextStation + 500);
    }
    let time = ''
    if (isTripLegStart) {
      if (plannedDepartureTime && plannedDepartureTime === estimatedOtherwisePlannedDepartureTime) {
        time = extractTime(plannedDepartureTime)
      } else if (plannedDepartureTime && estimatedOtherwisePlannedDepartureTime) {
        time = `
          <span class='time-changed'>${extractTime(plannedDepartureTime)}</span> 
          ${extractTime(estimatedOtherwisePlannedDepartureTime)}
        `
      }
    } else if (isTripLegStop) {
      if (plannedArrivalTime && plannedArrivalTime === estimatedOtherwisePlannedArrivalTime) {
        time = extractTime(plannedArrivalTime)
      } else if (plannedArrivalTime && estimatedOtherwisePlannedArrivalTime) {
        time = `
          <span class='time-changed'>${extractTime(plannedArrivalTime)}</span> 
          ${extractTime(estimatedOtherwisePlannedArrivalTime)}
        `
      }
    } else {
      if (plannedDepartureTime && plannedDepartureTime === estimatedOtherwisePlannedDepartureTime) {
        time = extractTime(plannedDepartureTime)
      } else if (plannedDepartureTime && estimatedOtherwisePlannedDepartureTime) {
        time = `
          <span class='time-changed'>${extractTime(plannedDepartureTime)}</span> 
          ${extractTime(estimatedOtherwisePlannedDepartureTime)}
        `
      }
    }
    const connector = `<div class='circle-station__connector ${alreadyPassed && !zoomStop ? 'station-passed' : ''}'></div>`
    const str = `
      <div class='circle-station ${alreadyPassed && !zoomStop ? 'station-passed' : ''}'>
      ${ index + 1 !== stops.length ? connector : "" }
      </div>
      <div class='time-and-station' id=${firstStopThatIsAlreadyPassed ? 'zoom-to-time-table-station' : ''}>
        <span class='vasttrafik-text time-text'>${time}</span>
        <span class='vasttrafik-text station-text'>${stopPoint.stopArea.name}</span>
      </div>`
    return str
  })

  const timeTable = document.createElement('div')
  timeTable.id = 'journey-time-table'
  timeTable.classList.add('journey-time-table')
  tripStopItems = tripStopItems.filter(item => item)
  tripStopItems.forEach(item => {
    timeTable.innerHTML += item
  })
  

  const wrapper = document.createElement('div')
  wrapper.id = 'vasttrafik-journey-info-elem'
  wrapper.classList.add('vasttrafik-journey-info-elem')
  wrapper.innerHTML = `
    <div class='vasttrafik-info__inner'>
      <header class='vasttrafik-info__header'>${vehicleType} ${name} mot ${shortDirection}</header>
      <div class='vasttrafik-info__main'>
        <div class='vasttrafik-info__line-info'>
          <span class='vasttrafik-info__line-badge' style='background-color: ${backgroundColor};color: ${foregroundColor}'>${name}</span>
          <div class='vasttrafik-text'>${!frontEntry ? fullDirection : fullDirection.slice(0, -17)}</div>
        </div>
        <div class='vasttrafik-info__transport-mode-info'>
          <i><img src='${iconUrl}' class='svg-icon' /></i>
          <div class='vasttrafik-text'>${vehicleType}${frontEntry}</div>
        </div>
      </div>

    </div>
  `
  document.body.appendChild(wrapper)
  const parent = document.getElementById("vasttrafik-journey-info-elem")
  const childNodes = Array.from(parent.childNodes)
  const inner = childNodes.find(child => {
    if (!child.classList) return false
    const classList = Array.from(child.classList)
    return classList.includes("vasttrafik-info__inner")
  })
  const speedTrackerParentElem = document.createElement('div')
  speedTrackerParentElem.id = "tracker-wrapper"
  speedTrackerParentElem.classList.add("tracker-wrapper") 
  speedTrackerParentElem.textContent = "Uppskattad hastighet: "

  const speedTrackingElem = document.createElement('div')
  speedTrackingElem.id = "speed-tracker"
  speedTrackingElem.classList.add('speed-tracker')
  speedTrackerParentElem.appendChild(speedTrackingElem)

  inner.appendChild(timeTable)
  inner.appendChild(speedTrackerParentElem)

  const zoomToThis = document.getElementById('zoom-to-time-table-station')
  zoomToThis.scrollIntoView({
    behavior: "smooth",
    block: "start"
  })
}

export function removeExistingJourneyInfoElem() {
  const allActiveJourneyInfoElems = Array.from(document.getElementsByClassName('vasttrafik-journey-info-elem'))
  allActiveJourneyInfoElems.forEach(elem => elem.remove())
  selectedJourney = null
}

function extractTime(dateStr) {
  return dateStr.slice(11, 16)
}

function msToTime(duration) {
    var milliseconds = parseInt((duration%1000)/100)
        , seconds = parseInt((duration/1000)%60)
        , minutes = parseInt((duration/(1000*60))%60)
        , hours = parseInt((duration/(1000*60*60))%24);

    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return hours + ":" + minutes + ":" + seconds + "." + milliseconds;
}