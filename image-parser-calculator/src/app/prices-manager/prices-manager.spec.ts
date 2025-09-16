import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PricesManager } from './prices-manager';

describe('PricesManager', () => {
  let component: PricesManager;
  let fixture: ComponentFixture<PricesManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PricesManager]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PricesManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
