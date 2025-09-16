import { TestBed } from '@angular/core/testing';

import { Prices } from './prices';

describe('Prices', () => {
  let service: Prices;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Prices);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
