// src/components/Topbar/Topbar.jsx
import "./Topbar.css";
import { useState } from "react";
import SearchBar from "../SearchBar/SearchBar";
import DownloadButton from "../DownloadButton/DownloadButton";

export default function Topbar({
  isStartpage,
  zoomOut,
  zoomIn,
  setPickedAddress,
  isMobile,
  setIsUserShowMenu,
  handleDownloadMap,
  handleDownloadJson,
}) {
  const [isUserShowSearchbar, setIsUserShowSearchbar] = useState(false);

  function handleZoomClick(isUp) {
    if (isUp) {
      zoomOut();
    } else {
      zoomIn();
    }
  }
  function handleShowSearchbarClick() {
    setIsUserShowSearchbar((prev) => !prev);
  }
  function handleShowMenuClick() {
    setIsUserShowMenu((prev) => !prev);
  }

  const isMobileAndMain = isMobile && !isStartpage;
  console.log(isMobile);
  return (
    <header className="topbar">
      <div className={"main-logo"}>
        <a
          className={
            isMobileAndMain
              ? "hamburger-a"
              : isMobile
              ? "main-logo--start-mobile"
              : ""
          }
          onClick={handleShowMenuClick}
        >
          <img
            src={
              isMobileAndMain
                ? "icon-hamburger--darkpurple.svg"
                : "thn_logo_liggande_lila_rgb.svg"
            }
            alt="Trollhättans Stads logo"
            style={{ maxWidth: "184px" }}
          />
        </a>
      </div>
      {!isStartpage && (
        <>
          <SearchBar
            setPickedAddress={setPickedAddress}
            show={!isMobile || isUserShowSearchbar}
            isMobile={isMobile}
          />
          {!isMobile && (
            <DownloadButton
              isMobile={true}
              onClickPdf={handleDownloadMap}
              onClickJson={handleDownloadJson}
            />
          )}
          <div className="topbar__tool-list-wrapper">
            <ul className="topbar__tool-list">
              <li title="Zooma ut" className="topbar-tool">
                <i>
                  <img
                    src="/icon-zoom-out--darkpurple.svg"
                    alt="Icon for zooming out"
                    onClick={() => handleZoomClick(false)}
                  />
                </i>
              </li>
              <li title="Zooma in" className="topbar-tool">
                <i>
                  <img
                    src="/icon-zoom-in--darkpurple.svg"
                    alt="Icon for zooming in"
                    onClick={() => handleZoomClick(true)}
                  />
                </i>
              </li>
              {isMobile && (
                <li className="topbar-tool">
                  <i>
                    <img
                      style={{ maxHeight: 36 }}
                      src="/icon-map-position--darkpurple.svg"
                      alt="Icon showing my position on the map"
                      onClick={handleShowSearchbarClick}
                    />
                  </i>
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </header>
  );
}
