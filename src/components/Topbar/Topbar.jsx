import "./Topbar.css";
import { useState, useEffect } from "react";

export default function Topbar({ isStartpage, zoomOut, zoomIn }) {
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function handleZoomClick(isUp) {
    if (isUp) {
      zoomOut()
    } else {
      zoomIn()
    }
  }
  


  return (
    <header className="topbar">
      <div className="main-logo">
        <a href="#">
          <img src={ isMobile && !isStartpage ? "thn_logo2_liggande_vit_rgb.svg" : "thn_logo_liggande_vit_rgb.svg"} alt="Trollhättans Stads logo"/> 
        </a>
      </div>       
      { !isStartpage && (
        <>
          <button title="Ladda ner din karta som en PDF" className="button button--primary" id="btn-save-my-map"><i><img className="download-icon" src="/icon-download--black.svg" alt="Download-icon" /></i>Ladda ner karta</button>
          <div className="topbar__tool-list-wrapper">
            <ul className="topbar__tool-list">
              <li title="Zooma ut" className="topbar-tool"><i><img src="/icon-zoom-out--white.svg" alt="Icon for zooming out" onClick={() => handleZoomClick(false)} /></i></li>
              <li title="Zooma in" className="topbar-tool"><i><img src="/icon-zoom-in--white.svg" alt="Icon for zooming in" onClick={() => handleZoomClick(true)} /></i></li>
              <li className="topbar-tool"><i><img src="/icon-map-position--white.svg" alt="Icon showing my position on the map" /></i></li>
            </ul>
          </div>
        </>
      ) }
    </header>
  )
}
