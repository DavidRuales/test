import * as THREE from 'three';

export function crearMaterialOroReal(texturaNormal = null, texturaRoughness = null) {
  const materialOro = new THREE.MeshPhysicalMaterial({
    // Color base calibrado para oro puro de 24k (valores lineales de reflectancia)
    color: new THREE.Color(0xffd700),
    metalness: 1.0,
    roughness: 0.16,
    
    // Capa de barniz/pulido espejo para reflejos secundarios
    clearcoat: 0.35,
    clearcoatRoughness: 0.12,
    
    // Iridiscencia sutil para simular la dispersión cromática en los bordes pulidos
    iridescence: 0.15,
    iridescenceIOR: 1.3,
    
    // Mapas de micro-detalle de tu GLB
    normalMap: texturaNormal,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: texturaRoughness,
    envMapIntensity: 1.8
  });

  // Uniforms personalizados para animar y controlar los destellos
  materialOro.userData.shaderUniforms = {
    uTime: { value: 0 },
    uGlintIntensity: { value: 3.5 }, // Intensidad del destello (ideal para Bloom)
    uGlintSharpness: { value: 180.0 }, // Qué tan puntual y fino es el destello
    uLightDir: { value: new THREE.Vector3(1.0, 1.5, 1.0).normalize() }
  };

  materialOro.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = materialOro.userData.shaderUniforms.uTime;
    shader.uniforms.uGlintIntensity = materialOro.userData.shaderUniforms.uGlintIntensity;
    shader.uniforms.uGlintSharpness = materialOro.userData.shaderUniforms.uGlintSharpness;
    shader.uniforms.uLightDir = materialOro.userData.shaderUniforms.uLightDir;

    // 1. Inyectar variables en el Vertex Shader para pasar la posición mundial
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `
        #include <common>
        varying vec3 vWorldPosition;
        varying vec3 vCustomNormal;
        `
      )
      .replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vCustomNormal = normalize(mat3(modelMatrix) * objectNormal);
        `
      );

    // 2. Inyectar matemáticas de destellos (Glints + Fresnel) en el Fragment Shader
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `
        #include <common>
        varying vec3 vWorldPosition;
        varying vec3 vCustomNormal;
        uniform float uTime;
        uniform float uGlintIntensity;
        uniform float uGlintSharpness;
        uniform vec3 uLightDir;

        // Ruido procedural de alta frecuencia para micro-facetas de oro martillado/pulido
        float hash31(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }
        `
      )
      .replace(
        '#include <dithering_fragment>',
        `
        // Vector desde la superficie hacia la cámara (cambia al manipular el objeto)
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vec3 normal = normalize(vCustomNormal);
        
        // Vector medio (Half-vector) entre la luz principal y la cámara
        vec3 halfVector = normalize(uLightDir + viewDir);
        
        // Cálculo de micro-facetas: genera puntos de reflexión microscópicos
        vec3 microGrid = floor(vWorldPosition * 280.0); 
        float sparkleNoise = hash31(microGrid);
        
        // Especular de altísima frecuencia (destello en crestas y bordes)
        float NdotH = max(dot(normal, halfVector), 0.0);
        float specularGlint = pow(NdotH, uGlintSharpness);
        
        // Efecto Fresnel: los bordes del oro reflejan luz blanca/cálida intensa al girar
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.5);
        
        // Combinación de destello dinámico y micro-chispas al mover la vista
        float glintMask = smoothstep(0.85, 0.99, sparkleNoise) * pow(NdotH, 35.0);
        float totalGlint = (specularGlint + glintMask * 0.6) * (0.4 + fresnel * 1.5);
        
        // Color del destello (blanco-dorado incandescente > 1.0 para activar HDR Bloom)
        vec3 glintColor = vec3(1.0, 0.94, 0.72) * totalGlint * uGlintIntensity;
        
        gl_FragColor.rgb += glintColor;
        #include <dithering_fragment>
        `
      );
  };

  return materialOro;
}