import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditBuildingModal } from './edit-building-modal';

describe('EditBuildingModal', () => {
  let component: EditBuildingModal;
  let fixture: ComponentFixture<EditBuildingModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditBuildingModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditBuildingModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
