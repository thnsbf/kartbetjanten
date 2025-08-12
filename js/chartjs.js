import { CESIUM_COLORS_DOM } from "./colors/colors.js"
export function initializeChart(parentElem, feature, keyName, payloadArr) {

  /*   
  const data = {
    labels: [
      'Red',
      'Blue',
      'Yellow'
    ],
    datasets: [{
      label: 'My First Dataset',
      data: [300, 50, 100],
      backgroundColor: [
        'rgb(255, 99, 132)',
        'rgb(54, 162, 235)',
        'rgb(255, 205, 86)'
      ],
      hoverOffset: 4
    }]
  }; */
  
  
  const canvas = document.createElement("canvas")
  canvas.id = "chart"
  canvas.classList.add("chart")
  const ctx = canvas.getContext('2d')

  parentElem.appendChild(canvas)
  
  const data = {
    labels: [],
    datasets: []
  }
  const dataset = {
    label: feature.name,
    data: [],
    backgroundColor: [],
    hoverOffset: 4,
    datalabels: {
      display: false
    }
  }

    for (let i = 0; i < feature.ionIds.length; i++) {
      data.labels.push(feature.names[i])
      dataset.data.push(payloadArr[i])
      dataset.backgroundColor.push(CESIUM_COLORS_DOM[feature.colorCategory][feature.colors[i]])
    }
  

  dataset.data = getPercentagesOfDataset(dataset.data)
  data.datasets.push(dataset)

  const config = {
    type: 'pie',
    data: data,
    options: {
      plugins: {
          legend: {
            display: false  // Hides the legend (usually shown at the top or side)
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.label || ''
                const value = context.parsed || 0
                return `${label}: ${value}%`
              }
            }
          },
      }
    }
  }

  return new Chart(ctx, config)

}  


function getPercentagesOfDataset(dataArr) {
  const totAmt = dataArr.reduce((acc, cur) => {
    return acc + cur
  }, 0)

  const percentages = dataArr.map(data => {
    return ((data / totAmt) * 100).toFixed(1)
  })
  return percentages
}



