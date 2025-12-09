import "./SearchBar.css";
import { readJson } from "../../modules/utils";

const ADRESSER = await readJson("json/ADRESSER_251127.json");
console.log(ADRESSER.features[0]);

export default function DropdownMenu({
  searchTerm,
  setPickedAddress,
  setSearchTerm,
}) {
  const normalizedSearch = searchTerm.toLowerCase().trim();

  const searchResults = ADRESSER.features.filter((address) => {
    const addr = address.properties.ADRESS.toLowerCase();
    const fast = address.properties.FASTIGHET.toLowerCase();

    return addr.includes(normalizedSearch) || fast.includes(normalizedSearch);
  });

  const liItems = searchResults.map((address, index) => {
    const addr = address.properties.ADRESS.toLowerCase();
    const fastighet = address.properties.FASTIGHET.toLowerCase();
    return (
      <li
        className="search-result-li-item"
        key={index}
        onClick={() => handleClickAddressItem(addr)}
      >
        {`${addr} / ${fastighet}`}
      </li>
    );
  });

  function handleClickAddressItem(address) {
    const addressItem = ADRESSER.features.find((addre) => {
      const addr = addre.properties.ADRESS.toLowerCase();
      return addr === address.toLowerCase();
    });
    setSearchTerm("");
    setPickedAddress(addressItem);
  }

  return (
    <div className="searchbar__dropdown">
      <ul>
        {liItems.length ? (
          liItems
        ) : (
          <li className="search-result-li-item">
            Sökningen returnerade inga träffar
          </li>
        )}
      </ul>
    </div>
  );
}
