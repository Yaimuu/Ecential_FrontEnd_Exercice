import { vec3, vec4 } from 'gl-matrix';

//for the sake of simplicity the class hardcode various light components
export class Light {
    position : vec4;
    ambientColor : vec3; // to modulate - multiply with - surface color
    specularColor : vec3;
    diffuseColor : vec3;
    shininess : number;

    constructor()
    {
        this.position=[ 0.0, 0.0, 0.0, 1.0];
        this.ambientColor=[ 0.8, 0.8, 0.8];
        this.specularColor=[ 0.5, 0.4, 0.3];
        this.diffuseColor=[ 0.5, 0.5, 0.5];
        this.shininess = 8.0;
    }
  }