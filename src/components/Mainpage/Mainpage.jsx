import "./Mainpage.css";
import Topbar from "../Topbar/Topbar";
import Sidebar from "../Sidebar/Sidebar";
import Globe from "../Viewer/Viewer";
import { useRef, useCallback, useState } from "react";
import { zoomToNextScaleStep } from "../../modules/zoom-to-scale";
import { zoomTo } from "../../modules/utils";
import MyObjects from "../MyObjects/MyObjects";
import { setAreaVisibility } from "../Tools/DrawArea/areaDraft"; 
import { setEntityGroupVisibility, removeEntityGroup } from "../../modules/utils";

export default function Mainpage({ pickedAddress }) {
  
  const [lon, lat] = pickedAddress.geometry.coordinates
  const viewerRef = useRef(null);
  const [activeTool, setActiveTool] = useState("no-tool")
  const [myObjectsIsOpen, setMyObjectsIsOpen] = useState(true)
  const entitiesRef = useRef(new Map());
  const [, setTick] = useState(0);
  const entitiesUpdateUI = useCallback(() => setTick(t => t + 1), []);

  const setEntitiesRef = useCallback((uuid, entity) => {
    entitiesRef.current.set(uuid, entity);
    entitiesUpdateUI();
  }, [entitiesUpdateUI]);

const updateShowHideEntitiesRef = useCallback((uuid, show) => {
  const ent = entitiesRef.current.get(uuid);
  if (!ent) return;

  // Toggle parent + children (points/labels/etc.)
  setEntityGroupVisibility(ent, !!show);

  ent.lastUpdated = new Date().toISOString();
  entitiesUpdateUI();
}, [entitiesUpdateUI]);

const removeAllInactiveEntitiesRef = useCallback(() => {
  const v = viewerRef.current;
  if (!v) return;

  // Collect which to delete first (avoid mutating while iterating)
  const toDelete = [];
  for (const [uuid, ent] of entitiesRef.current.entries()) {
    if (!ent.isActive) toDelete.push([uuid, ent]);
  }

  for (const [uuid, ent] of toDelete) {
    // Remove parent + all children from the scene
    removeEntityGroup(ent, v);
    // Remove from your registry
    entitiesRef.current.delete(uuid);
  }

  entitiesUpdateUI();
}, [entitiesUpdateUI]);

  const handleReady = useCallback((viewer) => {
    viewerRef.current = viewer;
    zoomIn() // Triggering by default on start-up to ensure scale is being used
  }, []);

  const zoomIn = () => zoomToNextScaleStep(viewerRef.current, +1, 140);
  const zoomOut = () => zoomToNextScaleStep(viewerRef.current, -1, 140);

  function handleClickAddressDisplay(viewerRef, lon, lat) {
    zoomTo(viewerRef.current, lon, lat)
    zoomIn() // Triggering by default to ensure scale is being used
  }

  return (
    <>
      <Topbar isStartpage={false} zoomIn={zoomIn} zoomOut={zoomOut} />
      <Sidebar 
        activeTool={activeTool} 
        setActiveTool={setActiveTool} 
      />
      <MyObjects 
        entitiesUpdateUI={entitiesUpdateUI} 
        entitiesRef={entitiesRef} 
        removeAllInactiveEntitiesRef={removeAllInactiveEntitiesRef} 
        updateShowHideEntitiesRef={updateShowHideEntitiesRef} 
        setMyObjectsIsOpen={setMyObjectsIsOpen}
        viewer={viewerRef}
      />
      <main className="main">
        <h2 
          className="heading-address-display" 
          onClick={() => handleClickAddressDisplay(viewerRef, lon, lat)}
        >
          {pickedAddress.properties.td_adress}
        </h2>
        <Globe 
          pickedAddress={pickedAddress} 
          onReady={handleReady}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          setEntitiesRef={setEntitiesRef}
          entitiesUpdateUI={entitiesUpdateUI}
          entitiesRef={entitiesRef}
        />
      </main>
    </>
  )
}
