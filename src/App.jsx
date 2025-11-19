import { useState } from "react";
import "./App.css";
import "cesium/Build/Cesium/Widgets/widgets.css";

import Startpage from "./components/Startpage/Startpage";
import Mainpage from "./components/Mainpage/Mainpage";

function App() {
  const [pickedAddress, setPickedAddress] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);

  return (
    <>
      {pickedAddress ? (
        <Mainpage
          pickedAddress={pickedAddress}
          setPickedAddress={setPickedAddress}
          isMobile={isMobile}
          setIsMobile={setIsMobile}
        />
      ) : (
        <Startpage setPickedAddress={setPickedAddress} isMobile={isMobile} />
      )}
    </>
  );
}

export default App;
