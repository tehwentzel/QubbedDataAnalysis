import React, {useState, useEffect, useRef, useCallback} from 'react';
import { Scene, StereoCamera } from 'three';
import Utils from '../modules/Utils.js';
import useSVGCanvas from "./useSVGCanvas.js";
import * as constants from "../modules/Constants.js"
import * as THREE from "three";
import * as d3 from 'd3';
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";

function getRenderer(){
    var r = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    r.setClearColor(0x888888, 1);
    r.setPixelRatio(window.devicePixelRatio);
    r.sortObjects = true;
    return r;
}

function getRenderOrder(organName){
    let order = constants.ORGAN_RENDER_ORDER[constants.ORGAN_NAME_MAP[organName]];
    if(order === undefined){
        order = constants.ORGAN_RENDER_ORDER[organName];
    } if(order === undefined){
        order = 0
    }
    return order;
}

function getCentroidTransform(pData){
    //returns a function that transforms the organs so they're centered and in the correct coordinate system
    var upperBounds = {x: false, y: false, z: false};
    var lowerBounds = {x: false, y: false, z: false};
    const getMin = (a,b) => {return (a & a <= b)? a: b};
    const getMax = (a,b) => {return (a & a > b)? a: b};

    const flip = (centroid)=>{
        //change these constants to "strecth" the image to make more space between organs
        let [x,y,z] = centroid;
        let fx = -1.2*y;//how much of an overbite
        let fy = -2.2*z;//how tall the head is
        let fz = -1.5*x;//how width the head is
        return [fx, fy, fz];
    }

    for(let [oName, oValues] of Object.entries(pData)){
        let [x,y,z] = flip(oValues.centroids);
        upperBounds.x = getMax(upperBounds.x, x);
        upperBounds.y = getMax(upperBounds.y, y);
        upperBounds.z = getMax(upperBounds.z, z);

        lowerBounds.x = getMin(lowerBounds.x, x);
        lowerBounds.y = getMin(lowerBounds.y, y);
        lowerBounds.z = getMin(lowerBounds.z, z);

    }
    const getMed = (key) => {return (upperBounds[key] + lowerBounds[key])/ 2}
    let median = [getMed('x'), getMed('y'), getMed('z')];
    let transformCentroid = (point) => {
        let [x,y,z] = flip(point);
        return [x - median[0], y - median[1], z - median[2]]
    }
    return transformCentroid
}



export default function PatientPlot3D(props){

    const mountRef = useRef(null);
    const [height, setHeight] = useState(0);
    const [width, setWidth] = useState(0);
    const [renderer, setRenderer] = useState();
    const[camera, setCamera] = useState();
    const [scene, setScene] = useState();
    const [controls, setControls] = useState();
    const [tTip, setTTip] = useState();
    const [currBrushedOrgan,setCurrBrushedOrgan] = useState('');
    const [onMouseMove, setOnMouseMove] = useState();
    // const [svg, height,width, tTip] = useSVGCanvas(mountRef);

    const outlineSize = 4;
    const brushedOrganOpacity = Utils.min(1.5*props.organMeshOpacity, 1);
    const nodeSize = 2;
    const cameraDist = 500;
    const nodeGeometry = new THREE.SphereGeometry(nodeSize, 16);
	const outlineGeometry = new THREE.SphereGeometry(outlineSize, 16);
    const organScale = 1;//how much to scale organ models
    const tumorOpacity = .75;//make tumor s more opaque
    const mouseVector = new THREE.Vector2(-500, -500);
    const mouse = new THREE.Vector2(-500,500);
    const nodeColor = new THREE.Color().setHex(0xa0a0a0);
    const nodeBrushedColor = new THREE.Color().setHex(0xffffff);
    const cameraSyncInterval = 50;//how quickly (miliseconds?) the cameras update to sync across views
    //materials for nodes at the centroids
    const nodeMaterial = new THREE.MeshStandardMaterial({
        color: nodeColor,
        roughness: 0.5,
        metalness: 0,
        flatShading: true,
    });

    const outlineMaterial = new THREE.MeshBasicMaterial({
        color: 0x3d3d3d,
        side: THREE.BackSide
    });

    const getOrganColor = (oName, od,rescalers)=>{
        const key = 'mean_dose';
        let val = od[key];
        // console.log(val,rescalers[key]);
        if(!val){
            return "black";
        }
        else{
            let scaler = rescalers[key];
            let scaledVal = scaler(val);
            if(Utils.isTumor(oName)){
                return d3.interpolateGreys(scaledVal**.5).toString();
            }
            return d3.interpolateReds(scaledVal).toString();
        }
    }

    const getOpacity = function(organName, organData, opacity){
        return Utils.isTumor(organName)? tumorOpacity: opacity;
    }

    const unbrush = () =>{
        if(!props.pData || !scene){ return; }
        for(let [organName, organData] of Object.entries(props.pData)){
            if(organName == props.brushedOrganName){continue;}
            unbrushOrgan(organName);
        }
    }

    const unbrushOrgan = function(organName){
        if(!scene){ return; }
        //brush organs on highlight
        try{
            let bMesh = scene.getObjectByName(organName+'Model');
            let bNodeOutline = scene.getObjectByName(organName+'NodeOutline');
            bMesh.material.opacity = getOpacity(organName,
                props.pData[organName],
                props.organMeshOpacity);
            bNodeOutline.material.color = new THREE.Color(0x3d3d3d);

            bNodeOutline.material.needsUpdate = true;
            bMesh.material.needsUpdate = true;
        } catch{}
    }

    const brush = function(organName){
        if(!scene || !organName){return;}
        try{
            let mesh = scene.getObjectByName(organName+'Model');
            let nodeOutline = scene.getObjectByName(organName+'NodeOutline');
            let node = scene.getObjectByName(organName+'Node');
            mesh.material.opacity = brushedOrganOpacity;
            nodeOutline.material.color.set(new THREE.Color('white'));

            mesh.needsUpdate = true;
            nodeOutline.needsUpdate = true;
        } catch{}
    }

    const handleMouseDown = function(){
        //when you click on the item, make this the camera you sync to
        if(camera !== undefined){
            props.setMainCamera(camera);
        }
    }

    const handleMouseMove = (e)=>{
        //track mousemovement?
        if(width <= 0 || height <= 0){return;}
        if(e.target){
            //I need a sperate thing for raycasting according to stack exchange?
            mouseVector.x = (e.nativeEvent.offsetX / width) * 2 - 1;
            mouseVector.y = -(e.nativeEvent.offsetY / height) * 2 + 1;
            mouse.x = e.nativeEvent.clientX;
            mouse.y = e.nativeEvent.clientY;

            if(scene){
                props.raycaster.setFromCamera(mouseVector,camera);
                var intersects = props.raycaster.intersectObjects(scene.children);
                var intersected = false;
                if(intersects.length >= 1){
                    for(let i of intersects){
                        let obj = i.object;
                        if(obj.userData.type === "organNode"){
                            Utils.moveTTip(tTip, mouse.x, mouse.y);
                            let oName = obj.userData.organName;
                            let oData = props.pData[oName]
                            let tipText = obj.userData.organName + '</br>' 
                                + 'Mean Dose (Gy): ' + oData.mean_dose
                                + '</br> Volume (cc): ' + oData.volume;
                            tTip.html(tipText);
                            intersected = true;
                            if(props.brushedOrganName != obj.userData.organName){
                                props.setBrushedOrganName(obj.userData.organName);
                            }
                            break;
                        }
                    }
                }
                if(!intersected){
                    Utils.hideTTip(tTip);
                    if(props.brushedOrganName !== ''){
                        props.setBrushedOrganName('');
                    }
                } 
            }
        }
    };

    useEffect( () => {
        //wait for mounting to calculate parent container size
        if(!mountRef.current){ return; }
        var h = mountRef.current.clientHeight*.99;
        var w = mountRef.current.clientWidth;

        if(d3.select('.tooltip').empty()){
            d3.select('body').append('div')
                .attr('class','tooltip')
                .style('visibility','hidden');
        }
        var tip = d3.select('.tooltip');

        setHeight(h);
        setWidth(w);
        setTTip(tip);
    },[mountRef.current]);

    
    useEffect( () => {
        //setup camera
        if(width <= 0 || height <= 0){ return; }

        const sceneScale = 2; //how big the head is relative to the scene 2 is normal;
        var camera = new THREE.OrthographicCamera(
            -width/sceneScale,
            width/sceneScale,
            height/sceneScale,
            -height/sceneScale,
            1, 1000);
        camera.position.z = props.cameraPositionZ;

        // orientation marker, patient coordinate system
        const boxSize = Utils.min(height,width)/10;
        var MovingCubeGeom = new THREE.BoxGeometry(boxSize,boxSize,boxSize, 1, 1, 1, props.materialArray);
        var MovingCube = new THREE.Mesh(MovingCubeGeom, props.materialArray);
        MovingCube.position.set(width/2 - 1.2*boxSize, -height/2 + 1.2*boxSize,-props.cameraPositionZ);
        MovingCube.name = "orientationCube";
        MovingCube.renderOrder = 1;
        camera.add(MovingCube);
        
        var renderer = getRenderer();
        renderer.setSize(width, height)
        mountRef.current.appendChild(renderer.domElement);


        setRenderer(renderer);
        setCamera(camera);
    },[height, width]);

    useEffect(() => {

        //placing the organ models and making the scene and conrols
        if(!renderer || !props.pId || !props.pData || !props.rescalers){ return; }
        var newScene = new THREE.Scene();
        camera.updateProjectionMatrix();
        newScene.add(camera);

        //setup controls
        var controls = new OrbitControls(camera, renderer.domElement);
        controls.minDistance = 2;
        controls.maxDistance = 5000;
        controls.enablePan = false;
        controls.enableZoom = false;

        //calculate transform to center the organs around the origin and orient correctly
        var transformCentroid = getCentroidTransform(props.pData);

        function makeOrganCentroid(organName, organData){
            let [x,y,z] = transformCentroid(organData.centroids);
            let organSphere = new THREE.Mesh(nodeGeometry.clone(), nodeMaterial.clone());
            organSphere.position.x = x;
            organSphere.position.y = y;
            organSphere.position.z = z;
            organSphere.name = organName + 'Node';
            organSphere.userData.organName = organName;
            let outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial.clone());
            outlineMesh.name = organName + "NodeOutline";
            outlineMesh.userData.type = 'organNodeOutline';
            organSphere.add(outlineMesh);

            organSphere.userData.type = 'organNode';
            return organSphere;
        }

        function makeOrganModel(organName, organData){
            let [x,y,z] = transformCentroid(organData.centroids);
            let nodeColor = getOrganColor(organName, organData,props.rescalers);
            let organMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color(nodeColor),
                opacity: getOpacity(organName,organData,props.organMeshOpacity),
                transparent: true,
                depthTest: true,
                depthWrite: true,
                depthFunc: THREE.LessEqualDepth
            });

            let organModel = props.getOrganModel(organName,organScale);//actually a geomtery
            //use a bigger sphere is no organ
            if(organModel === undefined){
                let s = 4;//how much bigger default sphere is than centroid
                organModel = nodeGeometry.clone().scale(s,s,s);
            }
            let scaled;
            if(Utils.isTumor(organName)){
                let volScale = props.rescalers['volume']['GTV'];
                let volume = organData['volume'];
                if(volume){
                    //this just scales the tumor relative to the size of it
                    //as of 9/8/2021 this divides by the median value of the organ (GTVs)
                    scaled = volScale(volume);
                    let k = 7*scaled;//idk just a number to make it bigger
                    organModel = organModel.clone().scale(k,k,k)
                }
            } else{
                //scale model size relative to the median
                let volScale = props.rescalers['volume'][organName];
                let volume = organData['volume'];
                if(!volume){
                    volume = 1;
                }
                scaled = volScale(volume);
                let k = scaled;
                organModel = organModel.clone().scale(k,k,k);
            }
            let mesh = new THREE.Mesh(organModel, organMaterial);

            mesh.position.x = x;
            mesh.position.y = y;
            mesh.position.z = z;

            mesh.rotation.x = -Math.PI / 2.0;
            mesh.rotation.z = -Math.PI / 2;

            let renderOrder = getRenderOrder(organName);
            if(renderOrder !== undefined){
                mesh.renderOrder = renderOrder;
            }
            mesh.name = organName + 'Model';
            mesh.userData.type = 'organMesh';
            mesh.userData.organName = organName;
            mesh.userData.defaultMaterial = organMaterial.clone();
            return mesh
        }

        //place the organ centroids
        for(let [organName, organData] of Object.entries(props.pData)){
            // console.log(organName, organData);
            let organCenter = makeOrganCentroid(organName, organData);
            newScene.add(organCenter);

            let organMesh = makeOrganModel(organName, organData);
            if(organMesh !== undefined){
                newScene.add(organMesh)
            }

            
        }
        setScene(newScene);
        setControls(controls);
    },[renderer, props.pId, props.pData,props.rescalers])

    useEffect(() => {
        //update camera position based on selected camera
        const interval = setInterval(() => {
          if(camera !== undefined & props.mainCamera !== undefined & scene !== undefined){
            camera.position.subVectors(props.mainCamera.position,controls.target);
            camera.lookAt(scene.position);
          }
        }, cameraSyncInterval);
        return () => clearInterval(interval);
    }, [renderer, scene, camera,props.mainCamera]);

    useEffect(() => {
        unbrush();
        brush(props.brushedOrganName);
    },[props.brushedOrganName]);


    useEffect(() => {
        //main animate loop
        if(!renderer || !scene || !camera){ return; }
        let animate = function () {
            requestAnimationFrame( animate );
            renderer.clear();

            if(controls){
                var rotMatrix = new THREE.Matrix4();
                rotMatrix.extractRotation(controls.object.matrix);

                var orientationCube = camera.getObjectByName("orientationCube");
                orientationCube.rotation.setFromRotationMatrix(rotMatrix.transpose());
            }

            renderer.render( scene, camera );
        }
    
        animate();
    },[renderer, scene, camera,props.mainCamera,props.brushedOrganName]);

    return (
        <div ref={mountRef} className={props.className} 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        >
            {props.pId}
        </div>
    )
}
