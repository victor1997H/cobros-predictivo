import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Footer } from '../footer/footer';
import { Navbar } from '../navbar/navbar';
import { Sidebar } from '../sidebar/sidebar';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [Sidebar, Navbar, Footer, RouterOutlet],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {}
