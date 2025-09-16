import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  currentRoute = '';

  constructor(private router: Router) {
    // Listen for route changes to highlight active nav item
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.currentRoute = event.url;
        console.log('Current route:', this.currentRoute);
      }
    });
  }

  navigateToView(path: string): void {
    this.router.navigate([path]);
  }

  isActiveRoute(path: string): boolean {
    if (path === '/industry') {
      return this.currentRoute === '/' || this.currentRoute === '/industry';
    }
    return this.currentRoute === path;
  }
}
