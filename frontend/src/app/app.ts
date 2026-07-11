import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Sidebar } from './layouts/sidebar/sidebar';
import { Navbar } from './layouts/navbar/navbar';
import { Footer } from './layouts/footer/footer';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    Sidebar,
    Navbar,
    Footer,
    RouterOutlet
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {

}