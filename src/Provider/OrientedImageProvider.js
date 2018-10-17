import * as THREE from 'three';
import format from 'string-format';
import Extent from '../Core/Geographic/Extent';
import Fetcher from './Fetcher';
import OrientationUtils from '../utils/OrientationUtils';
import CameraCalibrationParser from '../Parser/CameraCalibrationParser';
import OrientedImageMaterial from '../Renderer/OrientedImageMaterial';
import GeoJsonParser from '../Parser/GeoJsonParser';
// import Coordinates from '../Core/Geographic/Coordinates';

function createSphere(radius) {
    if (!radius || radius <= 0) return undefined;
    var geometry = new THREE.SphereGeometry(radius, 32, 32);
    var material = new THREE.MeshPhongMaterial({ color: 0x7777ff, side: THREE.DoubleSide, transparent: true, opacity: 0.5, wireframe: true });
    var sphere = new THREE.Mesh(geometry, material);
    sphere.visible = true;
    sphere.name = 'OrientedImageBackground';
    return sphere;
}

function preprocessDataLayer(layer) {
    layer.format = layer.format || 'json';
    layer.networkOptions = layer.networkOptions || { crossOrigin: '' };
    layer.background = layer.background || createSphere(layer.sphereRadius);
    layer.poses = null;
    layer.currentPano = undefined;
    layer.cameras = [];
    // layer.object3d = layer.object3d || new THREE.Group();

    if (!(layer.extent instanceof Extent)) {
        layer.extent = new Extent(layer.crs, layer.extent);
    }
    if (layer.background) {
        layer.background.layer = layer;
        layer.object3d.add(layer.background);
    }

    var promises = [];

    // layer.orientations: a GEOJSON file with position/orientation for all the oriented images
    promises.push(Fetcher.json(layer.orientations, layer.networkOptions)
        .then(orientations => GeoJsonParser.parse(orientations, layer)));
        // .then(collection => OrientationParser.parse(collection.features, layer)));
    // layer.calibrations: a JSON file with calibration for all cameras
    // it's possible to have more than one camera (ex: ladybug images with 6 cameras)
    promises.push(Fetcher.json(layer.calibrations, layer.networkOptions).then(calibrations =>
        CameraCalibrationParser.parse(calibrations, layer)));

    return Promise.all(promises).then((res) => {
        layer.poses = res[0].features;
        layer.cameras = res[1];
        layer.material = new OrientedImageMaterial(layer.cameras);

        const isGlobe = layer.crsOut == 'EPSG:4978';

        // add position attributes from point feature
        for (const pose of layer.poses) {
            var coord = pose.vertices[0];
            pose.position = coord.xyz();
            pose.quaternion = OrientationUtils.quaternionFromAttitude(pose.properties, coord, isGlobe);
        }
    });
}

// request textures for an oriented image
function executeCommand(command) {
    const layer = command.layer;
    const pano = command.requester;
    if (pano != layer.currentPano) {
        // command is outdated, do nothing
        return Promise.resolve();
    }
    const imageId = pano.properties.id;
    var promises = [];
    for (const camera of layer.cameras) {
        var sensorId = camera.name;
        var url = format(layer.images, { imageId, sensorId });
        promises.push(Fetcher.texture(url, layer.networkOptions));
    }
    return Promise.all(promises).then(result => command.resolve(result));
}

export default {
    preprocessDataLayer,
    executeCommand,
};
