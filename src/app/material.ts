import { vec3, vec4 } from 'gl-matrix';

//for the sake of simplicity the class hardcode various light components
export class Material {
    ambientColor : vec3; // to modulate - multiply with - surface color
    specularColor : vec3;
    diffuseColor : vec3;
    shininess : number;

    constructor()
    {
        this.ambientColor=[ 0.8, 0.7, 0.6];
        this.diffuseColor=[ 0.9, 0.85, 0.8];
        this.specularColor=[ 0.3, 0.3, 0.3];
        this.shininess = 8.0;
    }
  }