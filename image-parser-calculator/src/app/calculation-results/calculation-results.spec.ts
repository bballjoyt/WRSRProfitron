import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalculationResults } from './calculation-results';

describe('CalculationResults', () => {
  let component: CalculationResults;
  let fixture: ComponentFixture<CalculationResults>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalculationResults]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CalculationResults);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
