import "./MouseMoveCoordinates.css";
import { useMouseCoordinates } from "./useMouseCoordinates";

function fmt(n, decimals = 3) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function MouseMoveCoordinates({ viewer }) {
  const coords = useMouseCoordinates(viewer);

  return (
    <div id="mouse-move-coordinates-wrapper" className="mouse-move-coordinates-wrapper">
      {coords ? (
        <>
          <div><strong>Lon/Lat (°):</strong> {fmt(coords.lon, 6)}, {fmt(coords.lat, 6)}</div>
        </>
      ) : (
        <></>
      )}
    </div>
  );
}
