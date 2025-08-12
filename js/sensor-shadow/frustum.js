import { isValidCartesian3 } from "./sensor-shadow-utils.js";
export function drawFrustumVolume(viewer, camera, color = Cesium.Color.YELLOW.withAlpha(0.8)) {
  const frustum = camera.frustum;
  if (!(frustum instanceof Cesium.PerspectiveFrustum)) {
      console.warn("Unsupported frustum type.");
      return;
  }

  const near = frustum.near;
  const far = frustum.far;
  const fov = frustum.fov;
  const aspect = frustum.aspectRatio;

  const tanFov = Math.tan(fov / 2.0);
  const nearHeight = 2 * near * tanFov;
  const nearWidth = nearHeight * aspect;
  const farHeight = 2 * far * tanFov;
  const farWidth = farHeight * aspect;

  function getCorners(w, h, d) {
      return [
          new Cesium.Cartesian3(-w / 2, -h / 2, -d),
          new Cesium.Cartesian3(w / 2, -h / 2, -d),
          new Cesium.Cartesian3(w / 2, h / 2, -d),
          new Cesium.Cartesian3(-w / 2, h / 2, -d)
      ];
  }

  const nearCorners = getCorners(nearWidth, nearHeight, near);
  const farCorners = getCorners(farWidth, farHeight, far);

  function cameraToWorld(local) {
      const x = Cesium.Cartesian3.multiplyByScalar(camera.right, local.x, new Cesium.Cartesian3());
      const y = Cesium.Cartesian3.multiplyByScalar(camera.up, local.y, new Cesium.Cartesian3());
      const z = Cesium.Cartesian3.multiplyByScalar(Cesium.Cartesian3.negate(camera.direction, new Cesium.Cartesian3()), local.z, new Cesium.Cartesian3());

      const worldOffset = Cesium.Cartesian3.add(x, y, new Cesium.Cartesian3());
      Cesium.Cartesian3.add(worldOffset, z, worldOffset);
      return Cesium.Cartesian3.add(camera.position, worldOffset, new Cesium.Cartesian3());
  }

  const nearWorld = nearCorners.map(cameraToWorld);
  const farWorld = farCorners.map(cameraToWorld);

  const lines = [];

  // Near plane edges
  for (let i = 0; i < 4; i++) {
      lines.push(nearWorld[i]);
      lines.push(nearWorld[(i + 1) % 4]);
  }

  // Far plane edges
  for (let i = 0; i < 4; i++) {
      lines.push(farWorld[i]);
      lines.push(farWorld[(i + 1) % 4]);
  }

  // Connect near to far
  for (let i = 0; i < 4; i++) {
      lines.push(nearWorld[i]);
      lines.push(farWorld[i]);
  }

  viewer.entities.add({
      name: "Frustum Volume",
      polyline: {
          positions: lines,
          width: 2,
          material: color,
          arcType: Cesium.ArcType.NONE
      }
  });
}


export function computeViewMatrix(position, direction, up) {
  const z = Cesium.Cartesian3.normalize(Cesium.Cartesian3.negate(direction, new Cesium.Cartesian3()), new Cesium.Cartesian3());
  const x = Cesium.Cartesian3.normalize(Cesium.Cartesian3.cross(up, z, new Cesium.Cartesian3()), new Cesium.Cartesian3());
  const y = Cesium.Cartesian3.cross(z, x, new Cesium.Cartesian3());

  const m = new Cesium.Matrix4();

  m[0] = x.x; m[4] = x.y; m[8]  = x.z; m[12] = -Cesium.Cartesian3.dot(x, position);
  m[1] = y.x; m[5] = y.y; m[9]  = y.z; m[13] = -Cesium.Cartesian3.dot(y, position);
  m[2] = z.x; m[6] = z.y; m[10] = z.z; m[14] = -Cesium.Cartesian3.dot(z, position);
  m[3] = 0.0; m[7] = 0.0; m[11] = 0.0; m[15] = 1.0;

  return m;
}

export function computeHorizontalFOV(cameraPos, viewPos, rightVec) {
  const vectorToView = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.subtract(viewPos, cameraPos, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
  );

  // Project onto horizontal plane
  const projRight = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.cross(Cesium.Cartesian3.UNIT_Z, vectorToView, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
  );

  const dot = Cesium.Cartesian3.dot(projRight, rightVec);
  const angle = Math.acos(dot) * 2; // full cone
  return Cesium.Math.toDegrees(angle);
}


function getDegreesFromRadian(radian) {
  return radian * 180 / Math.PI
}

export function drawCustomFrustum(viewer, camera, options = {}) {
  const {
      color = Cesium.Color.CYAN.withAlpha(0.6),
      maxRenderDistance = null, // ⬅️ You can override this as needed
      coneWidth
  } = options;

  const frustum = camera.frustum;
  

  const hFOV = Cesium.Math.toRadians(coneWidth);
  const vFOV = camera.frustum._fovy;
  console.log(getDegreesFromRadian(camera.frustum._fovy))
  console.log(getDegreesFromRadian(camera.frustum.fov))


  const renderNear = Math.min(frustum.near, maxRenderDistance / 10); // Keep it small
  const renderFar = Math.min(frustum.far, maxRenderDistance);        // Clamp far plane

  const origin = camera.position;
  const dir = Cesium.Cartesian3.normalize(camera.direction, new Cesium.Cartesian3());
  const up = Cesium.Cartesian3.normalize(camera.up, new Cesium.Cartesian3());
  const right = Cesium.Cartesian3.normalize(camera.right, new Cesium.Cartesian3());

  // Plane centers
  const nearCenter = Cesium.Cartesian3.add(
      origin,
      Cesium.Cartesian3.multiplyByScalar(dir, renderNear, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
  );

  const farCenter = Cesium.Cartesian3.add(
      origin, 
      Cesium.Cartesian3.multiplyByScalar(dir, renderFar, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
  );

  // Corner calculator
  function getPlaneCorners(center, width, height) {
    const halfWidth = Cesium.Cartesian3.multiplyByScalar(right, width / 2, new Cesium.Cartesian3());
    const halfHeight = Cesium.Cartesian3.multiplyByScalar(up, height / 2, new Cesium.Cartesian3());

    const corners = [
        Cesium.Cartesian3.add(center, Cesium.Cartesian3.add(Cesium.Cartesian3.negate(halfWidth, new Cesium.Cartesian3()), halfHeight, new Cesium.Cartesian3()), new Cesium.Cartesian3()), // top-left
        Cesium.Cartesian3.add(center, Cesium.Cartesian3.add(halfWidth, halfHeight, new Cesium.Cartesian3()), new Cesium.Cartesian3()), // top-right
        Cesium.Cartesian3.add(center, Cesium.Cartesian3.subtract(halfWidth, halfHeight, new Cesium.Cartesian3()), new Cesium.Cartesian3()), // bottom-right
        Cesium.Cartesian3.add(center, Cesium.Cartesian3.subtract(Cesium.Cartesian3.negate(halfWidth, new Cesium.Cartesian3()), halfHeight, new Cesium.Cartesian3()), new Cesium.Cartesian3()) // bottom-left
    ];

    // OPTIONAL: remove corners that fall under terrain (expensive but precise)
    // You could sample terrain height at each corner (async) and filter those out.

    return corners;
  }

  // Calculate visual plane sizes
const nearHeight = 2 * Math.tan(vFOV / 2) * renderNear;
const nearWidth = 2 * Math.tan(hFOV / 2) * renderNear;

const farHeight = 2 * Math.tan(vFOV / 2) * renderFar;
const farWidth = 2 * Math.tan(hFOV / 2) * renderFar;

  const nearCorners = getPlaneCorners(nearCenter, nearWidth, nearHeight);
  const farCorners = getPlaneCorners(farCenter, farWidth, farHeight);

  const lines = [];

  for (let i = 0; i < 4; i++) {
      // Near rectangle
      lines.push(nearCorners[i], nearCorners[(i + 1) % 4]);

      // Far rectangle
      lines.push(farCorners[i], farCorners[(i + 1) % 4]);

      // Side edges
      lines.push(nearCorners[i], farCorners[i]);
  }

  return viewer.entities.add({
      name: "Capped Frustum Wireframe",
      polyline: {
          positions: lines,
          width: 2,
          material: color,
          arcType: Cesium.ArcType.NONE
      }
  });
}

export function drawShaderAlignedConeFrustum(viewer, cameraPosition, viewPosition, coneWidthDegrees, options = {}) {
    if (!isValidCartesian3(cameraPosition) || !isValidCartesian3(viewPosition)) {
        console.warn("Invalid input to drawShaderAlignedConeFrustum", { cameraPosition, viewPosition });
        return;
    }
  const {
      color = Cesium.Color.RED.withAlpha(0.6),
      segments = 32,
      horizontalRings = 5, // number of cross rings
  } = options;

  const direction = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.subtract(viewPosition, cameraPosition, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
  );

  const distance = Cesium.Cartesian3.distance(cameraPosition, viewPosition);
  const halfAngleRad = Cesium.Math.toRadians(coneWidthDegrees / 2);
  const baseRadius = Math.tan(halfAngleRad) * distance;

  const worldUp = Cesium.Cartesian3.UNIT_Z;
  const right = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.cross(direction, worldUp, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
  );
  const up = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.cross(right, direction, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
  );

  const circlePoints = [];
  const lines = [];

  // Base ring and radial lines
  for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * 2 * Math.PI;
      const xOffset = Math.cos(theta) * baseRadius;
      const yOffset = Math.sin(theta) * baseRadius;

      const offset = Cesium.Cartesian3.add(
          Cesium.Cartesian3.multiplyByScalar(right, xOffset, new Cesium.Cartesian3()),
          Cesium.Cartesian3.multiplyByScalar(up, yOffset, new Cesium.Cartesian3()),
          new Cesium.Cartesian3()
      );

      const point = Cesium.Cartesian3.add(viewPosition, offset, new Cesium.Cartesian3());
      circlePoints.push(point);

      lines.push(cameraPosition, point); // radial
      lines.push(point, circlePoints[(i + 1) % segments]); // ring
  }

  // Horizontal cross-rings
for (let ring = 1; ring <= horizontalRings; ring++) {
  const frac = ring / horizontalRings;
  const ringDistance = frac * distance;
  const ringRadius = Math.tan(halfAngleRad) * ringDistance;

  const ringCenter = Cesium.Cartesian3.add(
      cameraPosition,
      Cesium.Cartesian3.multiplyByScalar(direction, ringDistance, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
  );

  const ringPoints = [];

  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    const x = Math.cos(theta) * ringRadius;
    const y = Math.sin(theta) * ringRadius;

    const rightOffset = Cesium.Cartesian3.multiplyByScalar(right, x, new Cesium.Cartesian3());
    const upOffset = Cesium.Cartesian3.multiplyByScalar(up, y, new Cesium.Cartesian3());

    const offset = Cesium.Cartesian3.add(rightOffset, upOffset, new Cesium.Cartesian3());

    // ✅ Add this safeguard here
    if (Cesium.Cartesian3.magnitude(offset) < 1e-5) {
        console.warn(`Skipping degenerate offset at theta ${theta}`);
        continue;
    }

    const point = Cesium.Cartesian3.add(ringCenter, offset, new Cesium.Cartesian3());

    if (Cesium.defined(point)) {
        ringPoints.push(point);
    }
}


  // Now connect ring points into a closed loop
  for (let i = 0; i < ringPoints.length; i++) {
    const p1 = ringPoints[i];
    const nextIndex = (i + 1) % ringPoints.length;
    const p2 = ringPoints[nextIndex];
  
    // Confirm both are defined and valid Cartesian3s
    if (
      Cesium.defined(p1) &&
      Cesium.defined(p2) &&
      typeof p1.x === "number" &&
      typeof p2.x === "number"
    ) {
      lines.push(p1, p2);
    } else {
      console.warn("Skipping invalid ring segment:", { i, p1, p2 });
    }
  }
  
}


  return viewer.entities.add({
      name: "Shader-Aligned Frustum With Cross Rings",
      polyline: {
          positions: lines.filter(p => Cesium.defined(p)),
          width: 1,
          material: color,
          arcType: Cesium.ArcType.NONE,
      }
  });
}

export function computeConeWidthFromEdge(cameraPosition, edgePoint, viewPosition) {
  const direction = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.subtract(viewPosition, cameraPosition, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
  );

  const cameraToEdge = Cesium.Cartesian3.subtract(edgePoint, cameraPosition, new Cesium.Cartesian3());
  const projectionLength = Cesium.Cartesian3.dot(cameraToEdge, direction);

  const projectedPointOnAxis = Cesium.Cartesian3.add(
      cameraPosition,
      Cesium.Cartesian3.multiplyByScalar(direction, projectionLength, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
  );

  const baseRadius = Cesium.Cartesian3.distance(projectedPointOnAxis, edgePoint);

  const halfAngle = Math.atan2(baseRadius, projectionLength);
  return Cesium.Math.toDegrees(halfAngle * 2); // full angle in degrees
}

export function getShaderMatchedConeWidth(inputDeg) {
    const x = inputDeg;

    // Exact Lagrange interpolation
    const terms = [
        { xi: 170,  yi: 1.502 },
        { xi: 157.5,  yi: 3.32 },
        { xi: 135,  yi: 7.05 },
        { xi: 130,  yi: 6.85 },
        { xi: 112.5, yi: 8.52 },
        { xi: 90,   yi: 9 },
        { xi: 67.5, yi: 8.95 },
        { xi: 45,   yi: 6.823 },
        { xi: 22.5,   yi: 4.25 },
        { xi: 10,   yi: 1.9 },

    ];

    let result = 0;

    for (let i = 0; i < terms.length; i++) {
        let term = terms[i];
        let li = 1;
        for (let j = 0; j < terms.length; j++) {
            if (i !== j) {
                li *= (x - terms[j].xi) / (term.xi - terms[j].xi);
            }
        }
        result += term.yi * li;
    }
    return x - result;
}

