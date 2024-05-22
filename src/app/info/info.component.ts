import { Component } from '@angular/core';
import { Object } from '../object';
import { MeshData } from '../mockup_meshdata';

@Component({
  selector: 'app-info',
  templateUrl: './info.component.html',
  styleUrls: ['./info.component.css'],
})
export class InfoComponent {
  object: Object = {
    vertice_count: 0,
    face_count: 0,
    name: 'Vertebra',
  };
  constructor()
  {
    let mesh =  new MeshData();

    this.object.vertice_count= mesh.vertices.length;
    this.object.face_count= mesh.faces.length;
  }
};
