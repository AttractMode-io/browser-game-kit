import * as THREE from '/vendor/three.module.js';
import {mountThreeAccountUI} from '/integrations/threejs.mjs';
const account=mountThreeAccountUI({returnTo:'/examples/threejs',element:document.querySelector('#account-menu')});
const canvas=document.querySelector('#scene'),status=document.querySelector('#scene-status'),score=document.querySelector('#scene-score');
let renderer,geometry,material,hits=0;
try{const saved=Number(sessionStorage.getItem('am-kit-threejs-hits'));if(Number.isSafeInteger(saved)&&saved>=0&&saved<=1000000)hits=saved;}catch{}
score.textContent=`${hits} hits`;
const hit=()=>{score.textContent=`${++hits} hits`;try{sessionStorage.setItem('am-kit-threejs-hits',String(hits));}catch{}};
document.querySelector('#score-button').addEventListener('click',hit);
try {
 renderer=new THREE.WebGLRenderer({canvas,antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 const scene=new THREE.Scene();scene.background=new THREE.Color('#111827');
 const camera=new THREE.PerspectiveCamera(45,1,0.1,100);camera.position.z=4;
 geometry=new THREE.BoxGeometry();material=new THREE.MeshNormalMaterial();
 const cube=new THREE.Mesh(geometry,material);scene.add(cube);
 const raycaster=new THREE.Raycaster();
 canvas.addEventListener('pointerdown',event=>{const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);if(raycaster.intersectObject(cube).length)hit();});
 renderer.setAnimationLoop(time=>{const width=Math.max(1,Math.min(canvas.parentElement.clientWidth,720)),height=Math.min(width,400);renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();cube.rotation.x=time/1500;cube.rotation.y=time/2000;renderer.render(scene,camera);});
 status.textContent='Guest scene is running. Account lookup happens independently.';
} catch {status.textContent='WebGL is unavailable. The keyboard hit button and optional account panel still work.';}
window.addEventListener('pagehide',()=>{account.dispose();renderer?.setAnimationLoop(null);renderer?.dispose();geometry?.dispose();material?.dispose();},{once:true});
