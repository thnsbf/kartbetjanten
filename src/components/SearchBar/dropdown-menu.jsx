import "./SearchBar.css";
import { readJson } from "../../modules/utils";

const ADRESSER = await readJson("/json/adresser.json")

export default function DropdownMenu({searchTerm, setPickedAddress}) {

  const searchResults = ADRESSER.features.filter(address => {

    const addr = address.properties.td_adress.toLowerCase()
    return addr.toLowerCase().includes(searchTerm)
  })

  const liItems = searchResults.map((address, index) => {
    const addr = address.properties.td_adress
    return <li className="search-result-li-item" key={index} onClick={() => handleClickAddressItem(addr)}>{addr}</li>
  })

  function handleClickAddressItem(address) {
    const addressItem = ADRESSER.features.find(addre => {
      const addr = addre.properties.td_adress.toLowerCase()
      return addr === address.toLowerCase()
  })
    setPickedAddress(addressItem)
  }

  return (
    <div className="searchbar__dropdown">
      <ul>
        { liItems.length ? liItems : <li className="search-result-li-item">Sökningen returnerade inga träffar</li> }
      </ul>
    </div>
  )
}
