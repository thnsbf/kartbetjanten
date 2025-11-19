import "./Startpage.css";
import Topbar from "../Topbar/Topbar";
import SearchBar from "../SearchBar/SearchBar";
export default function Startpage({ setPickedAddress, isMobile }) {
  return (
    <>
      <Topbar isStartpage={true} isMobile={isMobile} />
      <main className="main--start">
        <h1 className="heading">Välkommen till Kartbetjänten</h1>
        <p className="text">
          Här skapar du en karta till ditt ärende. Kartan uppfyller kraven för
          enklare tillståndsärenden inom bygg- och miljöområdena.
          <br />
          <br />
          Börja med att söka på den adress eller fastighet som ärendet gäller i
          sökrutan här nedan.
        </p>
        <SearchBar setPickedAddress={setPickedAddress} show={true} />
        <p className="text">
          <span className="text--bold">OBS!</span> Om du tänker bygga nytt eller
          bygga nära fastighetsgräns krävs en Nybyggnadskarta som beställs hos
          Kontaktcenter (
          <a href="kontaktcenter@trollhattan.se">
            kontaktcenter@trollhattan.se
          </a>
          , <a href="tel:0520495000">0520-495000</a>)
        </p>
      </main>
    </>
  );
}
