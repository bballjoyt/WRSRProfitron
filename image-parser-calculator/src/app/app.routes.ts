import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/industry',
    pathMatch: 'full'
  },
  {
    path: 'industry',
    loadComponent: () => import('./industry-manager/industry-manager').then(m => m.IndustryManager)
  },
  {
    path: 'upload',
    loadComponent: () => import('./image-upload/image-upload').then(m => m.ImageUpload)
  },
  {
    path: 'prices',
    loadComponent: () => import('./prices-manager/prices-manager').then(m => m.PricesManager)
  },
  {
    path: 'results',
    loadComponent: () => import('./calculation-results/calculation-results').then(m => m.CalculationResults)
  },
  {
    path: 'building-details/:name',
    loadComponent: () => import('./building-details/building-details').then(m => m.BuildingDetails)
  },
  {
    path: 'resource-tree',
    loadComponent: () => import('./resource-tree/resource-tree').then(m => m.ResourceTreeComponent)
  }
];
