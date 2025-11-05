import "./Sidebar.css";
import { useRef } from "react";

const TOOLS = [
  {
    inputId: "radio-no-tool",
    value: "no-tool",
    displayName: "Inget verktyg"
  },
  {
    inputId: "radio-place-dot",
    value: "place-dot",
    displayName: "Placera punkt"
  },
  {
    inputId: "radio-draw-lines",
    value: "draw-lines",
    displayName: "Rita linjer"
  },
  {
    inputId: "radio-draw-area",
    value: "draw-area",
    displayName: "Rita area"
  },
  {
    inputId: "radio-move-object",
    value: "move-object",
    displayName: "Flytta objekt"
  },
  {
    inputId: "radio-place-text",
    value: "place-text",
    displayName: "Placera text"
  }
]

export default function Sidebar({ activeTool, setActiveTool }) {
  
  const linesBtnRef = useRef(null);

  function handleRadioChange(e) {
    const target = e.target
    if (target.name !== "tools") return
    if (target.value === activeTool) return

    setActiveTool(e.target.value)
  }


  const toolLiItems = TOOLS.map(tool => {
    const isLines = tool.value === "draw-lines";
    return (
      <li 
        className="sidebar-menu-item" 
        key={tool.value}
        ref={isLines ? linesBtnRef : undefined}
      >
        <input 
          id={tool.inputId} 
          value={tool.value} 
          className="radio-menu" 
          type="radio" 
          title={tool.displayName} 
          name="tools" 
          checked={tool.value === activeTool} 
          readOnly 
        />
        { tool.displayName }
      </li>
    )
  })

  return (
    <aside className="sidebar">
      <form onChange={(e) => handleRadioChange(e)}>
        <ul>
          { toolLiItems }
        </ul>
      </form>
      <hr className="sidebar-hr" />
    </aside>
  )
}
