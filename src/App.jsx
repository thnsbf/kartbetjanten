import { useState } from 'react'
import './App.css'
import 'cesium/Build/Cesium/Widgets/widgets.css';

import Startpage from './components/Startpage/Startpage';
import Mainpage from './components/Mainpage/Mainpage';

function App() {
  const [pickedAddress, setPickedAddress] = useState(null)
  return (
    <>
    {
      pickedAddress ? (
        <Mainpage pickedAddress={pickedAddress} />
      ) : (
        <Startpage setPickedAddress={setPickedAddress} />
      )
    }
    </>
    
  )
}

export default App
