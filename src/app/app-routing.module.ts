import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PlanningComponent } from './planning/planning.component';
import { InfoComponent } from './info/info.component';

const routes: Routes = [
  { path: 'planning', component: PlanningComponent },
  { path: 'info', component: InfoComponent }

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
