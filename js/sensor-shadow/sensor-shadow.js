import { sampleTerrainFromDegrees, sampleTerrainFromCartesian, convertCartesianToDegrees, addMetersToLongLat, drawAxes, orientCameraToSurface, isValidCartesian, isValidCartesian3 } from "./sensor-shadow-utils.js";
import { fsShader } from "./fs-shader.js";
import { hideShowElem } from "../ui-helpers.js";
import { getShaderMatchedConeWidth, drawFrustumVolume, computeViewMatrix, drawCustomFrustum, computeHorizontalFOV, drawShaderAlignedConeFrustum, computeConeWidthFromEdge } from "./frustum.js";

const buttons = {
    activate: document.getElementById("start-shader-btn"),
    clear: document.getElementById("clear-shader-btn"),
    cancel: document.getElementById("cancel-shader-btn")
}

hideShowElem(buttons.clear)
hideShowElem(buttons.cancel)


let sensorShadowInstance = null
let cameraPoint = null
let viewPoint = null
let customFrustum = null
let userPickedCamPoint = null
let userPickedCamPointSampledHeight = null
let userPickedViewPoint = null
let tempFrustum = null


export default async function sensorShadow(viewer, options) {


const {
  ShadowMap,
  PerspectiveFrustum,
  Camera,
  Color,
  defaultValue,
  PositionProperty,
  ConstantPositionProperty,
  Cartesian2,
  Cartesian3,
  Cartesian4,
  EllipsoidTerrainProvider,
  PostProcessStage,
  Math : CesiumMath
} = Cesium;

// Sensor options

const defaultValues = {
  cameraPosition: new ConstantPositionProperty(),
  viewPosition: new ConstantPositionProperty(),
  viewAreaColor: new Color(0, 1, 0),
  shadowAreaColor: new Color(1, 0, 0),
  alpha: 0.37,
  frustum: true,
  size: 4096
};


class SensorShadow {
  /**
   * Constructs a new SensorShadow instance.
   *
   * @param {Object} viewer - A reference to the Cesium viewer instance.
   * @param {Object} options - An optional configuration object.
   *
   * @example
   * let sensorShadow = new SensorShadow(viewer, {
   *   cameraPosition: new Cartesian3(0, 0, 0),
   *   viewPosition: new Cartesian3(1, 1, 1),
   *   viewAreaColor: new Color(0, 1, 0),
   *   shadowAreaColor: new Color(1, 0, 0),
   *   alpha: 0.5,
   *   frustum: true,
   *   size: 512
   * });
   */
  constructor(viewer, options = {}) {
      this.viewer = viewer;
      this._isDestroyed = false;
      this._shouldRebuildShadow = false;

      this.cameraPosition =
          typeof options.cameraPosition.getValue === "function"
              ? options.cameraPosition
              : new ConstantPositionProperty(options.cameraPosition);

      this.viewPosition =
          typeof options.viewPosition.getValue === "function"
              ? options.viewPosition
              : new ConstantPositionProperty(options.viewPosition);

      this.viewAreaColor = defaultValue(
          options.viewAreaColor,
          defaultValues.viewAreaColor
      );

      this.shadowAreaColor = defaultValue(
          options.shadowAreaColor,
          defaultValues.shadowAreaColor
      );

      this.alpha = defaultValue(options.alpha, defaultValues.alpha);
      this.size = defaultValue(options.size, defaultValues.size);
      this.frustum = defaultValue(options.frustum, defaultValues.frustum);
      this.depthBias = defaultValue(options.depthBias, defaultValues.depthBias);
      this.coneWidth = defaultValue(options.coneWidth, 90);


      this.preUpdateListener = null;

      if (this.cameraPosition && this.viewPosition) {
          this._addToScene();
      }
  }

  /**
   * Get the actual position of the camera.
   * This method calculates the position vector based on the current time.
   *
   * @private
   * @returns {Cartesian3} The calculated camera position vector.
   */
  get _getVectors() {
      let positionVector = this.cameraPosition.getValue(
          this.viewer.clock.currentTime
      );
      let viewVector = this.viewPosition.getValue(this.viewer.clock.currentTime);
      let distanceBetweenVectors = Number(
          Cartesian3.distance(viewVector, positionVector).toFixed(1)
      );

      if (distanceBetweenVectors > 10000) {
          let multiple = 1 - 10000 / distanceBetweenVectors;
          positionVector = Cartesian3.lerp(
              positionVector,
              viewVector,
              multiple,
              new Cartesian3()
          );
      }

      return { positionVector, viewVector };
  }

  setCameraAndViewPositions(cameraCartesian, viewCartesian) {
    this.cameraPosition = new ConstantPositionProperty(cameraCartesian);
    this.viewPosition = new ConstantPositionProperty(viewCartesian);
    this._createShadowMap(); // fully rebuild light camera and shadow matrix
}

  destroy() {
      // If a pre-update listener was added, remove it
      if (this.preUpdateListener) {
          this.viewer.scene.preUpdate.removeEventListener(this.preUpdateListener);
          this.preUpdateListener = null;
      }

      // If there's a shadow map, dispose of it
      if (this.viewShadowMap) {
          this.viewShadowMap.dispose();
          this.viewShadowMap = null;
      }

      // Remove the post-process stage if it has been added
      if (this.postProcess) {
          this.viewer.scene.postProcessStages.remove(this.postProcess);
          this.postProcess = null;
      }

      // Remove this object from the scene primitives if it has been added
      this.viewer.scene.primitives.remove(this);

      // Explicitly remove references to potentially large objects to assist with garbage collection
      for (let property in this) {
          if (this.hasOwnProperty(property)) {
              delete this[property];
          }
      }

      // Set the destroyed flag
      this._isDestroyed = true;
  }

  isDestroyed() {
      // Return the destroyed status
      return this._isDestroyed;
  }


  /**
   * Adds the SensorShadow to the scene.
   *
   * @private
   */
  _addToScene() {
      this._createShadowMap();
      if (!this.viewShadowMap) {
        console.warn("SensorShadow: Shadow map creation failed or was skipped.");
        return;
    }
      this._addPostProcess()
      this.viewer.scene.primitives.add(this);
        
  }

  /**
   * Creates the shadow map.
   *
   * @private
   */
  _createShadowMap(updateOnly) {

      let { positionVector, viewVector } = this._getVectors;
      
      if (Cartesian3.equalsEpsilon(positionVector, viewVector, CesiumMath.EPSILON7)) {
        console.warn("SensorShadow: camera and view are too close — nudging view direction slightly.");
    
        // Artificially nudge viewVector forward a little
        viewVector = Cartesian3.add(
            positionVector,
            new Cartesian3(0.0, 0.0, 0.1),  // very small vector in Z
            new Cartesian3()
        );
    }

      const distance = Number(
          Cartesian3.distance(viewVector, positionVector).toFixed(1)
      );

      if (distance > 10000) {
          const multiple = 1 - 10000 / distance;
          positionVector = Cartesian3.lerp(
              positionVector,
              viewVector,
              multiple,
              new Cartesian3()
          );
      }

      const scene = this.viewer.scene;

      const camera = new Camera(scene);

      orientCameraToSurface(camera, positionVector, viewVector);
    /* drawAxes(viewer, camera.position, camera.right, camera.up, camera.direction); */
    
    camera.frustum = new PerspectiveFrustum({
        fov: Cesium.Math.toRadians(getShaderMatchedConeWidth(options.coneWidth)),
        aspectRatio: options.aspectRatio,
        near: 1.0,
        far: distance
    });

      const cleanProjectionMatrix = Cesium.Matrix4.computePerspectiveFieldOfView(
        camera.frustum.fov,
        camera.frustum.aspectRatio,
        camera.frustum.near,
        camera.frustum.far,
        new Cesium.Matrix4()
    );

      if (!updateOnly) {
          this.viewShadowMap = new ShadowMap({
              lightCamera: camera,
              enable: true,
              isPointLight: false,
              isSpotLight: true,
              cascadesEnabled: false,
              context: scene.context,
              size: this.size,
              pointLightRadius: distance,
              fromLightSource: false,
              maximumDistance: distance
          });
          this.viewShadowMap.debugShow = false
          const viewMatrix = computeViewMatrix(camera.position, camera.direction, camera.up);
            const viewProj = Cesium.Matrix4.multiply(cleanProjectionMatrix, viewMatrix, new Cesium.Matrix4());
            this.viewShadowMap._shadowMapMatrix = viewProj;
      } else {
          this.viewShadowMap._lightCamera.position = positionVector;
      }

      this.viewShadowMap.normalOffset = true;
      this.viewShadowMap._terrainBias.depthBias = 0.005;
        this.viewShadowMap._terrainBias.normalOffsetScale = 2.0; }

  /**
   * Adds post processing to the SensorShadow.
   *
   * @private
   */
  _addPostProcess() {
      const SensorShadow = this;

      const viewShadowMap = this.viewShadowMap;
      const primitiveBias = viewShadowMap._isPointLight
          ? viewShadowMap._pointBias
          : viewShadowMap._primitiveBias;
      this.postProcess = this.viewer.scene.postProcessStages.add(
          new PostProcessStage({
              fragmentShader: fsShader,
              uniforms: {
                  view_distance: function () {
                      return SensorShadow.distance;
                  },
                  viewArea_color: function () {
                      return SensorShadow.viewAreaColor;
                  },
                  shadowArea_color: function () {
                      return SensorShadow.shadowAreaColor;
                  },
                  percentShade: function () {
                      return SensorShadow.alpha;
                  },
                  shadowMap: function () {
                      return viewShadowMap._shadowMapTexture;
                  },
                  _shadowMap_cascadeSplits: function () {
                      return viewShadowMap._cascadeSplits;
                  },
                  _shadowMap_cascadeMatrices: function () {
                      return viewShadowMap._cascadeMatrices;
                  },
                  _shadowMap_cascadeDistances: function () {
                      return viewShadowMap._cascadeDistances;
                  },
                  shadowMap_matrix: function () {
                      return viewShadowMap._shadowMapMatrix;
                  },
                  shadowMap_camera_positionEC: function () {
                      return viewShadowMap._lightPositionEC;
                  },
                  shadowMap_camera_directionEC: function () {
                      return viewShadowMap._lightDirectionEC;
                  },
                  cameraPosition_WC: function () {
                      return SensorShadow.viewer.camera.positionWC;
                  },
                  viewPosition_WC: function () {
                      return SensorShadow.viewPosition.getValue(
                          SensorShadow.viewer.clock.currentTime
                      );
                  },
                  shadowMap_camera_up: function () {
                      return viewShadowMap._lightCamera.up;
                  },
                  shadowMap_camera_dir: function () {
                      return viewShadowMap._lightCamera.direction;
                  },
                  shadowMap_camera_right: function () {
                      return viewShadowMap._lightCamera.right;
                  },
                  ellipsoidInverseRadii: function () {
                      let radii = SensorShadow.viewer.scene.globe.ellipsoid.radii;
                      return new Cartesian3(1 / radii.x, 1 / radii.y, 1 / radii.z);
                  },
                  shadowMap_texelSizeDepthBiasAndNormalShadingSmooth: function () {
                      var viewShed2D = new Cartesian2();
                      viewShed2D.x = 1 / viewShadowMap._textureSize.x;
                      viewShed2D.y = 1 / viewShadowMap._textureSize.y;

                      return Cartesian4.fromElements(
                          viewShed2D.x,
                          viewShed2D.y,
                          this.depthBias,
                          primitiveBias.normalShadingSmooth,
                          this.combinedUniforms1
                      );
                  },
                  shadowMap_normalOffsetScaleDistanceMaxDistanceAndDarkness:
                      function () {
                          return Cartesian4.fromElements(
                              primitiveBias.normalOffsetScale,
                              viewShadowMap._distance,
                              viewShadowMap.maximumDistance,
                              viewShadowMap._darkness,
                              this.combinedUniforms2
                          );
                      },
                  exclude_terrain: function () {
                      return (
                          SensorShadow.viewer.terrainProvider instanceof
                          EllipsoidTerrainProvider
                      );
                  },
                  coneAngle: function () {
                    return Cesium.Math.toRadians(options.coneWidth / 2); // half angle in radians
                },
                view_angle_degrees: function () {
                    return this.coneWidth;
                },
            
              },
          })
      );

      // If a previous listener was added, remove it
      if (this.preUpdateListener) {
          viewer.scene.preUpdate.removeEventListener(this.preUpdateListener);
      }

      // Add a new listener
      this.preUpdateListener = () => {
          if (!this.viewShadowMap._shadowMapTexture) {
              this.postProcess.enabled = false;
          } else {
              this.postProcess.enabled = true;
          }
      };

      viewer.scene.preUpdate.addEventListener(this.preUpdateListener);
  }

  update(frameState) {
    if (!this.viewShadowMap || !this.viewShadowMap._lightCamera) return;

    if (this._shouldRebuildShadow) {
        this._createShadowMap(true);  // full rebuild
        this._shouldRebuildShadow = false; // reset
    } else {
        const { positionVector, viewVector } = this._getVectors;
        const lightCamera = this.viewShadowMap._lightCamera;

        lightCamera.direction = Cartesian3.normalize(
            Cartesian3.subtract(viewVector, positionVector, new Cartesian3()),
            new Cartesian3()
        );
        lightCamera.right = Cartesian3.normalize(
            Cartesian3.cross(lightCamera.direction, Cartesian3.UNIT_Z, new Cartesian3()),
            new Cartesian3()
        );
        lightCamera.up = Cartesian3.normalize(
            Cartesian3.cross(lightCamera.right, lightCamera.direction, new Cartesian3()),
            new Cartesian3()
        );
    }

    frameState.shadowMaps.push(this.viewShadowMap);
}



  destroy() {
    if (this._isDestroyed) return;

    if (this.preUpdateListener) {
        this.viewer.scene.preUpdate.removeEventListener(this.preUpdateListener);
        this.preUpdateListener = null;
    }

    if (this.postProcess && this.viewer.scene.postProcessStages.contains(this.postProcess)) {
        this.viewer.scene.postProcessStages.remove(this.postProcess);
        this.postProcess = null;
    }

    if (this.viewShadowMap) {
        this.viewShadowMap.dispose();
        this.viewShadowMap = null;
    }

    // Clear other references to help GC
    this.viewer = null;
    this._cameraPosition = null;
    this._viewPosition = null;
    this._isDestroyed = true;
}

  get size() {
      return this._size;
  }

  set size(v) {
      this._size = v;
  }

  get depthBias() {
      return this._depthBias;
  }

  set depthBias(v) {
      this._depthBias = v;
  }

  get cameraPosition() {
      return this._cameraPosition;
  }

  set cameraPosition(v) {
      this._cameraPosition = v;
  }

  get viewPosition() {
      return this._viewPosition;
  }

  set viewPosition(v) {
      this._viewPosition = v;
  }

  get frustum() {
      return this._frustum;
  }

  set frustum(v) {
      this._frustum = v;
  }

  get distance() {
      return this._distance;
  }

  set distance(v) {
      this._distance = v;
  }

  get viewAreaColor() {
      return this._viewAreaColor;
  }

  set viewAreaColor(v) {
      this._viewAreaColor = v;
  }

  get shadowAreaColor() {
      return this._shadowAreaColor;
  }

  set shadowAreaColor(v) {
      this._shadowAreaColor = v;
  }

  get alpha() {
      return this._alpha;
  }

  set alpha(v) {
      this._alpha = v;
  }
}


  if (!viewer.terrainProvider || viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider) {
    console.warn("Terrain provider does not support terrain sampling. No viewshed created.");
    return;
  }

  const {
    lonCam,
    latCam,
    lonView,
    latView,
    heightOffset // Meters above ground where eye-sensor is placed, (ex. 1.70)

  } = options

  const sampledCameraHeight = await sampleTerrainFromDegrees(lonCam, latCam, viewer.terrainProvider, heightOffset)
  const sampledAimHeight = await sampleTerrainFromDegrees(lonView, latView, viewer.terrainProvider, heightOffset)

  const cameraPosition = Cesium.Cartesian3.fromDegrees(lonCam, latCam, sampledCameraHeight)
  const viewPosition = Cesium.Cartesian3.fromDegrees(lonView, latView, sampledAimHeight)

/* const osmBuildingsTileset = await Cesium.createOsmBuildingsAsync();
    viewer.scene.primitives.add(osmBuildingsTileset); */

cameraPoint = viewer.entities.add({
  position: cameraPosition,
  point: {
      pixelSize: 10,
      color: Cesium.Color.RED,
      disableDepthTestDistance: Number.POSITIVE_INFINITY
  },
  label: {
    text: 'Camera location',
    font: '16px sans-serif',
    fillColor: Cesium.Color.WHITE,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 2,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    disableDepthTestDistance: Number.POSITIVE_INFINITY
}
});
viewPoint = viewer.entities.add({
  position: viewPosition,
  point: {
      pixelSize: 10,
      color: Cesium.Color.BLUE,
      disableDepthTestDistance: Number.POSITIVE_INFINITY
      
  },
  label: {
    text: 'Aim',
    font: '16px sans-serif',
    fillColor: Cesium.Color.WHITE,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 2,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    disableDepthTestDistance: Number.POSITIVE_INFINITY

}
});



sensorShadowInstance = new SensorShadow(viewer, {
cameraPosition: cameraPoint.position._value,
viewPosition: viewPoint.position._value
});



/* customFrustum = drawShaderAlignedConeFrustum(viewer, cameraPoint.position.getValue(Cesium.JulianDate.now()),
    viewPoint.position.getValue(Cesium.JulianDate.now()), options.coneWidth) */

let handler;
let pickedEntity;
let cartesian;
handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
handler.setInputAction((click) => {
  cartesian = viewer.scene.pickPosition(click.position);
  if (cartesian) {
      var pickedObject = viewer.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && pickedObject.id === cameraPoint || Cesium.defined(pickedObject) && pickedObject.id === viewPoint ) {
          pickedEntity = pickedObject.id;
          viewer.scene.screenSpaceCameraController.enableInputs = false;
      }
  }
}, Cesium.ScreenSpaceEventType.LEFT_DOWN);

handler.setInputAction((movement) => {
  if (pickedEntity && viewer.scene.pickPositionSupported) {
    let newCartesian = viewer.scene.pickPosition(movement.endPosition);
      if (Cesium.defined(newCartesian)) {
          // Convert the picked Cartesian3 to Cartographic
          let newCartographic = Cesium.Cartographic.fromCartesian(newCartesian);

          // Get the original height
          let originalCartographic = Cesium.Cartographic.fromCartesian(
              pickedEntity.position.getValue(Cesium.JulianDate.now())
          );
          // Update the height to the original one
          newCartographic.height = originalCartographic.height;
          
       
          // Convert the updated Cartographic back to Cartesian3
          let updatedCartesian = Cesium.Cartographic.toCartesian(newCartographic);
          // Set the new position
          pickedEntity.position = new Cesium.ConstantPositionProperty(updatedCartesian);
          if (pickedEntity.id === viewPoint.id) {
            sensorShadowInstance._shouldRebuildShadow = false;
            sensorShadowInstance.viewPosition = pickedEntity.position
        } else if (pickedEntity.id === cameraPoint.id) {
            sensorShadowInstance._shouldRebuildShadow = true;
            sensorShadowInstance.cameraPosition = pickedEntity.position
        } else {
            console.warn("pickedEntity.id didn't match either ball (red/blue)")
          }
      }
  }
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

handler.setInputAction(async() => {
  if (pickedEntity) {

    const entityPositionCartesian = pickedEntity._position._value
    const sampledHeight = await sampleTerrainFromCartesian(entityPositionCartesian, viewer.terrainProvider, heightOffset)
    const { longitude, latitude } = convertCartesianToDegrees(entityPositionCartesian)

    const newPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude, sampledHeight)

      if (Cesium.defined(newPosition)) {
        // Convert the picked Cartesian3 to Cartographic
        let newCartographic = Cesium.Cartographic.fromCartesian(newPosition);

        // Convert the updated Cartographic back to Cartesian3
        let updatedCartesian = Cesium.Cartographic.toCartesian(newCartographic);
        // Set the new position
        pickedEntity.position = new Cesium.ConstantPositionProperty(updatedCartesian);

        if (pickedEntity.id === viewPoint.id) {
            sensorShadowInstance._shouldRebuildShadow = false;
            sensorShadowInstance.viewPosition = pickedEntity.position
        } else if (pickedEntity.id === cameraPoint.id) {
            sensorShadowInstance._shouldRebuildShadow = true;
            sensorShadowInstance.cameraPosition = pickedEntity.position
        } else {
        console.warn("pickedEntity.id didn't match either ball (red/blue)")
        }
      }

      pickedEntity = undefined;
      viewer.scene.screenSpaceCameraController.enableInputs = true;
  }
}, Cesium.ScreenSpaceEventType.LEFT_UP);

}
let supcHandler = null
  

function startUserPickCoordinates(viewer, options) {
    hideShowElem(buttons.activate)
    hideShowElem(buttons.cancel)
    let finalResult = {}
    supcHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    const container = document.getElementById("cesiumContainer")
    container.style.cursor = "crosshair"

    supcHandler.setInputAction(async (click) => {
        const cartesian = viewer.scene.pickPosition(click.position);
        if (!userPickedCamPoint) {
            userPickedCamPoint = convertCartesianToDegrees(cartesian)
            userPickedCamPointSampledHeight = await sampleTerrainFromDegrees(userPickedCamPoint.longitude, userPickedCamPoint.latitude, viewer.terrainProvider, options.heightOffset)
        } else {
            userPickedViewPoint = convertCartesianToDegrees(cartesian)
            finalResult = { 
                lonCam: userPickedCamPoint.longitude, 
                latCam: userPickedCamPoint.latitude,
                lonView: userPickedViewPoint.longitude, 
                latView: userPickedViewPoint.latitude, 
                ...options 
            }
            supcHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
            supcHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            if (Cesium.defined(tempFrustum)) {
                viewer.entities.remove(tempFrustum);
                tempFrustum = null;
            }  
            container.style.cursor = "default"
            hideShowElem(buttons.cancel)
            hideShowElem(buttons.clear)
            sensorShadow(viewer, finalResult)
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    supcHandler.setInputAction(async (movement) => {
        if (!userPickedCamPoint) return;

        const camLon = userPickedCamPoint.longitude
        const camLat = userPickedCamPoint.latitude

        const camCartesian = Cesium.Cartesian3.fromDegrees(camLon, camLat, userPickedCamPointSampledHeight);
        const cursorPosition = viewer.scene.pickPosition(movement.endPosition);

        if (!isValidCartesian3(cursorPosition)) return;

        // Remove previous temp frustum
        if (Cesium.defined(tempFrustum)) {
            viewer.entities.remove(tempFrustum);
            tempFrustum = null;
        }        

        // Draw new frustum from camPoint to cursor
        tempFrustum = drawShaderAlignedConeFrustum(viewer, camCartesian, cursorPosition, options.coneWidth, {
            color: Cesium.Color.YELLOW.withAlpha(0.4),
            segments: 32,
            horizontalRings: 4
        });
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
}


export async function handleStartShader(viewer) {
    const options = {
        heightOffset: Number(document.getElementById("shader-height").value),
        coneWidth: Number(document.getElementById("shader-width").value),
        aspectRatio: 1
    }
    startUserPickCoordinates(viewer, options)
}



export function handleClearShader(viewer) {
    if (sensorShadowInstance && !sensorShadowInstance.isDestroyed()) {
        hideShowElem(buttons.activate)
        hideShowElem(buttons.clear)
        viewer.entities.remove(cameraPoint)
        viewer.entities.remove(viewPoint)
        viewer.entities.remove(customFrustum)
        customFrustum = null
        userPickedCamPoint = null
        userPickedViewPoint = null
        supcHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
        supcHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE)
    try {
        sensorShadowInstance.destroy();
    } catch (error) {
    }
    
    sensorShadowInstance = null;
            
    }
}

export function handleCancelShader(viewer) {
    hideShowElem(buttons.activate)
    hideShowElem(buttons.cancel)
    supcHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
    supcHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    document.getElementById("cesiumContainer").style.cursor = "default"
    userPickedCamPoint = null
    userPickedViewPoint = null
    if (Cesium.defined(tempFrustum)) {
        viewer.entities.remove(tempFrustum);
        tempFrustum = null;
    }     
}