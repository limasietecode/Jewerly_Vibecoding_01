// MatCap Fragment Shader
precision mediump float;

varying vec3 vNormal;
varying vec3 vEye;

uniform sampler2D uMatcapTexture;

void main() {
  vec3 n = normalize(vNormal);
  
  // MatCap mapping: using the x and y components of the view-space normal
  // Remapped from [-1, 1] to [0, 1]
  vec2 uv = n.xy * 0.5 + 0.5;
  
  // Flip Y because some matcaps/webgl coords are flipped
  uv.y = 1.0 - uv.y;
  
  gl_FragColor = texture2D(uMatcapTexture, uv);
}
