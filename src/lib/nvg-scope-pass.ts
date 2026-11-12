import * as THREE from "three";

/** NVG scope diameter matches the HUD's min(70vh, 70vw) circle. */
export const NVG_LENS_DIAMETER_FRACTION = 0.70;

/** Match the magnified reticle fade; never run the effect for another optic. */
export function nvgScopeBlend(overlay: string | undefined, adsProgress: number, alive: boolean): number {
  if (overlay !== "nvg" || !alive || !Number.isFinite(adsProgress)) return 0;
  return Math.max(0, Math.min(1, (adsProgress - 0.5) / 0.45));
}

/**
 * Selectively color-grade the scoped pixels without another 3D scene pass.
 * The intermediate target and fullscreen quad are allocated only on first NVG
 * use, then reused (and resized when the drawing buffer changes).
 */
export class NvgScopePass {
  private target: THREE.WebGLRenderTarget | null = null;
  private readonly viewport = new THREE.Vector2();
  private readonly material: THREE.ShaderMaterial;
  private readonly quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor() {
    this.camera.position.z = 1;
    this.material = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        sourceImage: { value: null },
        viewportPx: { value: new THREE.Vector2(1, 1) },
        fade: { value: 1 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D sourceImage;
        uniform vec2 viewportPx;
        uniform float fade;
        varying vec2 vUv;
        void main() {
          vec4 original = texture2D(sourceImage, vUv);
          float luma = dot(original.rgb, vec3(0.2126, 0.7152, 0.0722));
          // Green-gray low-saturation scenery. Keep brightness detail visible.
          float shade = clamp(pow(max(luma, 0.0), 0.84) * 0.86 + 0.035, 0.0, 1.0);
          vec3 scenery = vec3(shade * 0.76, shade * 0.88, shade * 0.79);

          // Enemy body materials emit bright pure green in NVG; retain that green
          // but strip color from everything else. Brightness gates out foliage.
          float greenDelta = original.g - max(original.r, original.b);
          float signature = smoothstep(0.24, 0.47, greenDelta)
                          * smoothstep(0.53, 0.80, original.g);
          vec3 enemy = vec3(0.07, 1.0, 0.20) * max(0.63, shade);
          vec3 graded = mix(scenery, enemy, signature);

          // 70% circular lens; do not alter pixels beyond the scope border.
          float radius = min(viewportPx.x, viewportPx.y) * 0.35;
          float offset = length((vUv - 0.5) * viewportPx);
          float mask = 1.0 - smoothstep(radius - 2.0, radius + 2.0, offset);
          gl_FragColor = vec4(mix(original.rgb, graded, mask * fade), original.a);
          #include <colorspace_fragment>
        }
      `,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, fade: number): void {
    renderer.getDrawingBufferSize(this.viewport);
    const width = Math.max(1, Math.round(this.viewport.x));
    const height = Math.max(1, Math.round(this.viewport.y));
    if (!this.target) {
      this.target = new THREE.WebGLRenderTarget(width, height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: true,
        stencilBuffer: false,
      });
    } else if (this.target.width !== width || this.target.height !== height) {
      this.target.setSize(width, height);
    }
    const previousTarget = renderer.getRenderTarget();
    try {
      renderer.setRenderTarget(this.target);
      renderer.render(scene, camera);
      this.material.uniforms.sourceImage.value = this.target.texture;
      this.material.uniforms.viewportPx.value.set(width, height);
      this.material.uniforms.fade.value = fade;
      renderer.setRenderTarget(previousTarget);
      renderer.render(this.scene, this.camera);
    } finally {
      renderer.setRenderTarget(previousTarget);
    }
  }

  dispose(): void {
    this.target?.dispose();
    this.target = null;
    this.quad.geometry.dispose();
    this.material.dispose();
  }
}
