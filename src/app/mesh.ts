export class Mesh {
  normals: number[][];
  vertices: number[][];
  faces: number[][];

  constructor(vertices: number[][], faces: number[][], normals: number[][]) {
    this.normals = normals;
    this.vertices = vertices;
    this.faces = faces;
  }
}