import "./SearchBar.css";
import { useState } from "react";
import DropdownMenu from "./dropdown-menu";

export default function SearchBar({ setPickedAddress }) {

  const [searchTerm, setSearchTerm] = useState("")

  function updateSearchTerm(e) {
    setSearchTerm(e.target.value)
  }

  

  

  return (
    <div className="searchbar-wrapper">
      <input className="searchbar" type="text" placeholder="Sök adress eller fastighet" onChange={(e) => updateSearchTerm(e)} />
      <i className="icon icon--searchbar">
        <img src="icon-magnifying-glass--purple.svg" />  
      </i>
      {
        searchTerm.length > 1 && <DropdownMenu setPickedAddress={setPickedAddress} searchTerm={searchTerm} />
      }   
    </div>
  )
}
