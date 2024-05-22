import { Component , ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { Viewer } from '../viewer';
import { MeshData } from '../mockup_meshdata';

@Component({
  selector: 'app-planning',
  templateUrl: './planning.component.html',
  styleUrls: ['./planning.component.css']
})
export class PlanningComponent implements AfterViewInit {
  @ViewChild('canvasviewer', { static: true }) canvasviewer!: ElementRef<HTMLCanvasElement>;

  transparencyValue : number;
  view : any;
  mesh: any;
  toggle:boolean;
  isHolding:boolean;
  private lastX: number = 0;
  private lastY: number = 0;
  constructor()
  {
    this.transparencyValue= 0;
    this.toggle=true;
    this.isHolding = false;
  }
  ngAfterViewInit(): void {
      const canvasElement= this.canvasviewer.nativeElement as HTMLCanvasElement ;
      this.view= new Viewer(canvasElement);
      this.mesh = new MeshData();

      this.view.init(this.mesh,100-this.transparencyValue);
  }
  transparencyChange(value: number)
  {
    this.transparencyValue=value;
    // console.log("transparency value=",this.transparencyValue);   

    //this.view.init(this.mesh,100-this.transparencyValue);    
    this.view.reset(100-this.transparencyValue);    
  }  
  displayToggle(toggle: boolean)
  {
    this.toggle=toggle;
    // console.log("display value=",this.toggle);

    this.view.displayToggle(toggle);    
    this.view.display();    
  }
  // Mouse Events
  @HostListener('wheel', ['$event'])
  onScroll(event: WheelEvent) {
    // console.log(event)
    let scale : number = event.deltaY * -0.001;

    // Restrict scale
    scale = Math.min(Math.max(-1, scale), 1);

    this.view.zoom(scale);
    this.view.display();
  }
  onMouseDown(event: MouseEvent) {
    this.isHolding = true;
    this.lastX = event.offsetX;
    this.lastY = event.offsetY;
  }

  onMouseUp(event: MouseEvent) {
    if (this.isHolding) {
      this.onMouseMove(event);  // to ensure the last line segment is drawn
      this.isHolding = false;
    }
  }
  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (this.isHolding) {
      const offsetX = event.offsetX - this.lastX;
      const offsetY = event.offsetY - this.lastY;
      this.view.rotate(offsetX, offsetY);
      this.lastX = event.offsetX;
      this.lastY = event.offsetY;
    }
  }
}

