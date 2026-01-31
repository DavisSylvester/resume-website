import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrintResume } from './print-resume';

describe('PrintResume', () => {
  let component: PrintResume;
  let fixture: ComponentFixture<PrintResume>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrintResume]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrintResume);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
