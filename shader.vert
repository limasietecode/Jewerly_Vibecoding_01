// MatCap Vertex Shader
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;

varying vec2 vTexCoord;
varying vec3 vNormal;
varying vec3 vEye;

void main() {
  vec4 positionVec4 = uModelViewMatrix * vec4(aPosition, 1.0);
  gl_Position = uProjectionMatrix * positionVec4;
  
  vNormal = normalize(uNormalMatrix * aNormal);
  vEye = normalize(-positionVec4.xyz); 
  vTexCoord = aTexCoord;
}
