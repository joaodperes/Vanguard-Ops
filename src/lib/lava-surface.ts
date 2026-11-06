import * as THREE from "three";
import { lavaSurfaceY } from "./dynamic-environment";
import type { EnvironmentObject } from "./game-protocol";

/** World-space flow keeps adjoining pieces of the moat visually continuous. */
export function buildLavaSurface(lava: Extract<EnvironmentObject, { type: "lava" }>, time: THREE.IUniform<number>) {
  const material = new THREE.ShaderMaterial({
    fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), lavaTime: time },
    vertexShader: /* glsl */ `
      varying vec2 worldXZ;
      #include <fog_pars_vertex>
      void main() {
        worldXZ = (modelMatrix * vec4(position, 1.0)).xz;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float lavaTime;
      varying vec2 worldXZ;
      #include <fog_pars_fragment>

      float hash(vec2 p) {
        vec3 q = fract(p.xyx * 0.1031);
        q += dot(q, q.yzx + 33.33);
        return fract((q.x + q.y) * q.z);
      }
      float noise(vec2 p) {
        vec2 tile = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(tile), hash(tile + vec2(1.0, 0.0)), f.x),
                   mix(hash(tile + vec2(0.0, 1.0)), hash(tile + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        vec2 flow = worldXZ * 0.26 + vec2(lavaTime * 0.15, lavaTime * 0.08);
        float detail = noise(flow * 3.1 - vec2(lavaTime * 0.08, 0.0));
        float field = noise(flow + vec2(detail * 0.53));
        float fissure = 1.0 - smoothstep(0.025, 0.19, abs(field - 0.52));
        vec3 crust = mix(vec3(0.075, 0.005, 0.003), vec3(0.42, 0.028, 0.005), detail);
        vec3 molten = mix(vec3(0.92, 0.09, 0.008), vec3(1.0, 0.62, 0.035), detail);
        gl_FragColor = vec4(mix(crust, molten, fissure), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(lava.size[0] * 2, lava.size[2] * 2), material);
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = lavaSurfaceY(lava) - lava.pos[1];
  return surface;
}
