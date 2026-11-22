import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// 1. Cargar un HDRI con luces puntuales fuertes (ej. estudio oscuro o catedral)
new RGBELoader().load('ruta/a/royal_studio_4k.hdr', (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture;
  // Mantener el fondo oscuro o neutro hace que el oro destaque por contraste
});

// 2. Aplicar el shader a las mallas del GLB
const oroMaterial = crearMaterialOroReal();
const loader = new GLTFLoader();

loader.load('ruta/a/corona_o_reliquia.glb', (gltf) => {
  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      // Si el GLB ya trae normalMap o roughnessMap, los heredamos al nuevo shader
      if (child.material.normalMap) oroMaterial.normalMap = child.material.normalMap;
      if (child.material.roughnessMap) oroMaterial.roughnessMap = child.material.roughnessMap;
      
      child.material = oroMaterial;
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(gltf.scene);
});

// 3. Configurar Post-Procesado (Bloom selectivo)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.45, // Fuerza del resplandor (sutil y elegante, no radioactivo)
  0.6,  // Radio de dispersión
  1.15  // Threshold (Umbral): SOLO valores > 1.15 brillan (nuestros destellos)
);
composer.addPass(bloomPass);

// 4. En tu loop de animación (requestAnimationFrame):
function animate(time) {
  requestAnimationFrame(animate);
  oroMaterial.userData.shaderUniforms.uTime.value = time * 0.001;
  composer.render(); // Usar composer en lugar de renderer.render
}