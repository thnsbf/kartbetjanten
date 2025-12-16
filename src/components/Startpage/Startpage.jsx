import "./Startpage.css";
import Topbar from "../Topbar/Topbar";
import SearchBar from "../SearchBar/SearchBar";
import { isUnsupportedIosBrowser } from "../../modules/download-helpers";
import PopUpMessage from "../PopUpMessage/PopUpMessage";

const isUnsupportedBrowser = isUnsupportedIosBrowser();

export default function Startpage({ setPickedAddress, isMobile }) {
  return (
    <>
      <Topbar isStartpage={true} isMobile={isMobile} />
      <main className="main--start">
        {isUnsupportedBrowser && <PopUpMessage message="ios-browser" />}
        <div className="main-start__content">
          <h1 className="heading">Välkommen till Kartbetjänten</h1>
          <p className="text">
            Här skapar du en karta till ditt ärende. Kartan uppfyller kraven för
            enklare tillståndsärenden inom bygg- och miljöområdena.
            <br />
            <br />
            Börja med att söka på den adress eller fastighet som ärendet gäller
            i sökrutan här nedan. Om ärendet inte gäller en specifik adress kan
            du välja valfri adress som ingår i fastigheten.
          </p>
          <SearchBar setPickedAddress={setPickedAddress} show={true} />
          <p className="text">
            <span className="text--bold">OBS!</span> Om du tänker bygga nytt
            eller bygga nära fastighetsgräns krävs en Nybyggnadskarta som
            beställs hos Kontaktcenter (
            <a href="kontaktcenter@trollhattan.se">
              kontaktcenter@trollhattan.se
            </a>
            , <a href="tel:0520495000">0520-495000</a>)
          </p>
          <section className="main-start__footer">
            <p>
              <span>Kartbetjänten version 3.0 ©</span>
              <a href="https://www.trollhattan.se">Trollhättans stad</a> <br />
              Avvikelser i lägesredovisningen för fastighetsgränser kan
              förekomma. Juridiskt bindande gränsdokumentation finns hos{" "}
              <a href="https://www.lantmateriet.se/korrektagranser">
                Lantmäteriet
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
