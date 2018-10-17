import * as THREE from 'three';
import { MAIN_LOOP_EVENTS } from '../../Core/MainLoop';
import AnimationPlayer, { AnimatedExpression } from '../../Core/AnimationPlayer';

const MOVEMENTS = {
    38: { method: 'translateZ', sign: -1 }, // FORWARD: up key
    40: { method: 'translateZ', sign: 1 }, // BACKWARD: down key
    37: { method: 'translateX', sign: -1 }, // STRAFE_LEFT: left key
    39: { method: 'translateX', sign: 1 }, // STRAFE_RIGHT: right key
    33: { method: 'translateY', sign: 1 }, // UP: PageUp key
    34: { method: 'translateY', sign: -1 }, // DOWN: PageDown key
};

const MAX_FOV = 40;
const Verbose = false;
// Note: we could use existing three.js controls (like https://github.com/mrdoob/three.js/blob/dev/examples/js/controls/FirstPersonControls.js)
// but including these controls in itowns allows use to integrate them tightly with itowns.
// Especially the existing controls are expecting a continuous update loop while we have a pausable one (so our controls use .notifyChange when needed)

function onMouseDown(event) {
//    console.log(event);
    // event.preventDefault();
    this._isUserInteracting = true;

    this._onMouseDownMouseX = event.clientX;
    this._onMouseDownMouseY = event.clientY;
    this._onMouseDownPhi = this._phi;
    this._onMouseDownTheta = this._theta;

    if (Verbose) {
        // eslint-disable-next-line no-console
        console.log('IMMERSIVE CONTROL MOUSE DOWN', event);
    }
}

/*
// WORK IN PROGRESS ON DOUBLE CLICK -> MOUSE PICK
function onDoubleClick(event) {
    if (Verbose) {
        // eslint-disable-next-line no-console
        console.log('IMMERSIVE CONTROL DOUBLE CLICK', event);
    }
    const mouse = new THREE.Vector2((event.clientX / event.screenX) * 2 - 1, -(event.clientY / event.screenY) * 2 + 1);
    const raycaster = new THREE.Raycaster();

    raycaster.setFromCamera(mouse, this.camera);
    const intersects = raycaster.intersectObjects(this.view.scene.children, true);
    // eslint-disable-next-line no-console
    console.log('INTERSECT OBJECTS : ', intersects);
    // for (var i = 0; i < intersects.length; i++) {
    //     console.log(intersects[i]);
    // }
}
*/
function onMouseMove(event) {
    if (this._isUserInteracting === true) {
        // WORK IN PROGRESS ON PAN
        // if (this.shiftPressed) {
        //     // PAN MOVES
        //     // TODO : Stop move when mouse move ends.
        //     if (this.panMoveX) this.moves.delete(this.panMoveX);
        //     const deltaX = this._onMouseDownMouseX - event.clientX;
        //     if (deltaX < 0) {
        //         this.panMoveX = { method: 'translateX', sign: -10 };
        //     } else {
        //         this.panMoveX = { method: 'translateX', sign: 10 };
        //     }
        //     this.moves.add(this.panMoveX);
        //     // It doesn't work with 'translateY'
        // } else {
        //     // RETATION MOVES
        const fovCorrection = this.camera.fov / MAX_FOV; // 1 at MAX_FOV
        this._phi = -1 * (this._onMouseDownMouseX - event.clientX) * 0.13 * fovCorrection + this._onMouseDownPhi;
        this._theta = (event.clientY - this._onMouseDownMouseY) * 0.13 * fovCorrection + this._onMouseDownTheta;
    // }
        this.view.notifyChange(null, false);
    }
}
function onMouseWheel(event) {
    let delta = 0;
    const mult = 100;
    if (event.wheelDelta !== undefined) {
        delta = -event.wheelDelta * mult;
    // Firefox
    } else if (event.detail !== undefined) {
        delta = event.detail * mult;
    }
    if (Verbose) {
        // eslint-disable-next-line no-console
        console.log('DELTA', delta);
    }
    this.camera.fov =
        THREE.Math.clamp(this.camera.fov + Math.sign(delta),
            10,
            180);

    if (Verbose) {
        // eslint-disable-next-line no-console
        console.log('FOV', this.camera.fov);
    }

    this.camera.updateProjectionMatrix();
    this.view.notifyChange(this.camera);
}

function onMouseUp() {
    this._isUserInteracting = false;
    if (this.panMoveX) this.moves.delete(this.panMoveX);
}

function onKeyUp(e) {
    const move = MOVEMENTS[e.keyCode];
    if (move) {
        this.moves.delete(move);
        this.view.notifyChange();
        e.preventDefault();
    }

    // key Shift
    if (e.keyCode == 16) {
        this.shiftPressed = false;
    }
}

function onKeyDown(e) {
    if (e.repeat) return;
    if (Verbose) {
        // eslint-disable-next-line no-console
        console.log('IMERSIVE CONTROL KEY DOWN, ', e);
    }
    // key Z
    if (e.keyCode == 90) {
        this.moveCameraTo(getNextPano(this.currentLayer).position);
    }

    // key A
    if (e.keyCode == 65) {
        this.setCameraToCurrentPano();
    }

    // key B
    if (e.keyCode == 66) {
        this.setCameraId(this.cameraId + 1);
    }

    // key C
    if (e.keyCode == 67) {
        this.setCameraId(this.cameraId - 1);
    }

    // key D
    if (e.keyCode == 68) {
        this.moveCameraTo(getPrevPano(this.currentLayer).position);
    }

    // key E
    if (e.keyCode == 69) {
        this.nextLayer();
        this.moveCameraTo(getNextPano(this.currentLayer).position);
    }

    // key Shift
    if (e.keyCode == 16) {
        this.shiftPressed = true;
    }

    const move = MOVEMENTS[e.keyCode];
    if (move) {
        this.moves.add(move);
        this.view.notifyChange(null, false);
        e.preventDefault();
    }
}

// Expression used to damp camera's moves
function moveCameraExp(root, progress) {
    // smooth way
    const dampingProgress = 1 - Math.pow((1 - (Math.sin((progress - 0.5) * Math.PI) * 0.5 + 0.5)), 2);
    root.camera.position.lerpVectors(root.positionFrom, root.positionTo, dampingProgress);

    // no smooth, can be used to move at a constant speed, (if we want to repeat the move)
    // root.camera.position.lerpVectors(root.positionFrom, root.positionTo, progress);
}

function update2() {
    this.view.notifyChange(this.camera);
}

function getPanoPosition(layer, pano) {
    return { position: pano.vertices[0].xyz() };
}

function getNextPano(layer) {
    if (!layer.currentPano) return {};
    var index = (layer.currentPano.index + 1) % layer.poses.length;
    return getPanoPosition(layer, layer.poses[index]);
}

function getPrevPano(layer) {
    if (!layer.currentPano) return {};
    var index = (layer.currentPano.index + layer.poses.length - 1) % layer.poses.length;
    return getPanoPosition(layer, layer.poses[index]);
}

function getCurrentPano(layer) {
    if (!layer.currentPano) return {};
    return getPanoPosition(layer, layer.currentPano);
}

class ImmersiveControls extends THREE.EventDispatcher {

    // Animations
    constructor(view, options = {}) {
        super();

        this.camera = view.camera.camera3D;
        this.camera.far = 100;
        this.view = view;

        this.player = new AnimationPlayer();
        this.animationMoveCamera = new AnimatedExpression({ duration: 50, root: this, expression: moveCameraExp, name: 'Move camera' });

        this.layers = [];
        this.currentLayerIndex = 0;

        this.moves = new Set();
        this.moveSpeed = options.moveSpeed || 1; // backward or forward move speed in m/s
        this._isUserInteracting = false;
        this._onMouseDownMouseX = 0;
        this._onMouseDownMouseY = 0;
        this._onMouseDownPhi = 0;
        this._onMouseDownTheta = 0;

        this.objectCam = new THREE.Object3D();
        this.view.scene.add(this.objectCam);
        // this.axis = new THREE.AxisHelper( 50 );
        this.axis = new THREE.Object3D();
        this.objectCam.add(this.axis);

        this.cameraId = -1;
        this.camera.fov = 75;
        // this.axis.rotation.reorder('ZYX');
        // this._theta = THREE.Math.radToDeg(this.axis.rotation.x);
        // this._phi = THREE.Math.radToDeg(this.axis.rotation.z);
        // this.updateAngles();

        const lookAtPosition = this.camera.position.clone().multiplyScalar(1.1);
        this.setCameraOnPano(this.camera.position.clone(), lookAtPosition);

        this._handlerMouseDown = onMouseDown.bind(this);
        this._handlerMouseMove = onMouseMove.bind(this);
        this._handlerMouseUp = onMouseUp.bind(this);
        // this._handlerDoubleClick = onDoubleClick.bind(this);
        this._handlerKeyUp = onKeyUp.bind(this);
        this._handlerKeyDown = onKeyDown.bind(this);
        this._handlerMouseWheel = onMouseWheel.bind(this);
        this._handlerAnimation = update2.bind(this);

        this.domElement = view.mainLoop.gfxEngine.renderer.domElement;
        this.domElement.addEventListener('mousedown', this._handlerMouseDown, false);
        this.domElement.addEventListener('mousemove', this._handlerMouseMove, false);
        this.domElement.addEventListener('mouseup', this._handlerMouseUp, false);
        // this.domElement.addEventListener('dblclick', this._handlerDoubleClick, false);
        this.domElement.addEventListener('keyup', this._handlerKeyUp, true);
        this.domElement.addEventListener('keydown', this._handlerKeyDown, true);
        this.domElement.addEventListener('mousewheel', this._handlerMouseWheel, false);
        this.domElement.addEventListener('DOMMouseScroll', this._handlerMouseWheel, false); // firefox
        this.player.addEventListener('animation-frame', this._handlerAnimation);
        this.view.addFrameRequester(MAIN_LOOP_EVENTS.AFTER_CAMERA_UPDATE, this.update.bind(this));
    }

    dispose() {
        if (Verbose) {
            // eslint-disable-next-line no-console
            console.log('DISPOSE IMMERSIVE CONTROLS !!', this);
        }
        this.domElement.removeEventListener('mousedown', this._handlerMouseDown, false);
        this.domElement.removeEventListener('mousemove', this._handlerMouseMove, false);
        this.domElement.removeEventListener('mouseup', this._handlerMouseUp, false);
        this.domElement.removeEventListener('dblclick', this._handlerDoubleClick, false);

        this.domElement.removeEventListener('keyup', this._handlerKeyUp, true);
        this.domElement.removeEventListener('keydown', this._handlerKeyDown, true);

        this.domElement.removeEventListener('mousewheel', this._handlerMouseWheel, false);
        this.domElement.removeEventListener('DOMMouseScroll', this._handlerMouseWheel, false);

        this.player.removeEventListener('animation-frame', this._handlerAnimation);

        this.view.removeFrameRequester(MAIN_LOOP_EVENTS.AFTER_CAMERA_UPDATE, this);
    }

    addLayer(layer) {
        this.layers.push(layer);
        this.currentLayer = layer;
        this.currentLayerIndex = this.layers.length - 1;
    }

    nextLayer() {
        this.currentLayerIndex = (this.currentLayerIndex + 1) % this.layers.length;
        this.currentLayer = this.layers[this.currentLayerIndex];
    }

    isUserInteracting() {
        return this.moves.size !== 0;
    }

    setCameraToCurrentPano() {
        const nextPanoPosition = getNextPano(this.currentLayer).position;
        const currentPanoPosition = getCurrentPano(this.currentLayer).position;
        this.setCameraOnPano(currentPanoPosition, nextPanoPosition);
        // this.view.tileLayer.visible = !this.view.tileLayer.visible;
    }

    moveCameraTo(positionTo) {
        this.positionFrom = this.camera.position.clone();
        this.positionTo = positionTo;
        this.player.play(this.animationMoveCamera);
    }

    updateAngles() {
        // get angles from axis (axis rotation move as mouse move, in the plan tangent to the surface of the globe)
        this.axis.rotation.order = 'ZYX';
        this.axis.rotation.x = THREE.Math.degToRad(this._theta);
        this.axis.rotation.z = THREE.Math.degToRad(this._phi) + Math.PI;
        this.axis.updateMatrixWorld();

        const rotMatrix = new THREE.Matrix4();
        rotMatrix.multiplyMatrices(this.objectCam.matrix, this.axis.matrix);
        this.camera.rotation.setFromRotationMatrix(rotMatrix);

        this.view.notifyChange(this.camera);
    }

    setCameraOnPano(positionPano, nextPanoPosition) {
        if (!positionPano) {
            return;
        }
        // move camObject on the surface of the globe
        this.objectCam.position.copy(positionPano);
        this.objectCam.lookAt(this.objectCam.position.clone().multiplyScalar(1.1));
        this.objectCam.updateMatrixWorld();

        if (nextPanoPosition) { // rotate axis to look at next pano
            const nextPanoLocal = this.objectCam.worldToLocal(nextPanoPosition);
            this.axis.lookAt(nextPanoLocal);
            this.axis.updateMatrixWorld();
        }

        // move camera on objectCam position
        this.camera.position.copy(this.objectCam.position);
        this.camera.updateMatrixWorld();

        // save axis rotation
        this.axis.rotation.reorder('ZYX');
        this._theta = THREE.Math.radToDeg(this.axis.rotation.x);
        this._phi = THREE.Math.radToDeg(this.axis.rotation.z);
        this.updateAngles();
    }

    setCameraId(id) {
        const N = this.currentLayer.cameras.length + 1;
        this.cameraId = (id + N) % N;
        let camera = this.view.camera.camera3D;
        if (camera !== this.camera) {
            camera.far = camera.oldFar;
            camera.near = camera.oldNear;
            camera.aspect = camera.size.x / camera.size.y;
            camera.zoom = 1;
            camera.updateProjectionMatrix();
        }
        camera = this.currentLayer.cameras[this.cameraId] || this.camera;
        this.view.camera.camera3D = camera;
        if (camera !== this.camera) {
            camera.oldFar = camera.far;
            camera.oldNear = camera.near;
            camera.far = this.camera.far;
            camera.near = this.camera.near;
            camera.aspect = this.camera.aspect;
            camera.zoom = 0.5;
            camera.updateProjectionMatrix();
        }
        this.view.notifyChange(this.camera);
    }

    update(dt, updateLoopRestarted) {
        // if we are in a keypressed state, then update position

        // dt will not be relevant when we just started rendering, we consider a 1-frame move in this case
        if (updateLoopRestarted) {
            dt = 16;
        }

        for (const move of this.moves) {
            if (move.method === 'translateY') {
                const normal = this.objectCam.position.clone().normalize();
                this.camera.position.add(normal.multiplyScalar(move.sign * this.moveSpeed * dt / 1000));
            } else if (move.method === 'translateX') {
                // slow camera pan on X
                this.camera[move.method](move.sign * this.moveSpeed * 0.5 * dt / 1000);
            } else {
                // speed camera on tanslate Z
                this.camera[move.method](move.sign * this.moveSpeed * 2 * dt / 1000);
            }
        }

        if (this.moves.size || this._isUserInteracting) {
            this.updateAngles();
        }
    }
}

export default ImmersiveControls;
