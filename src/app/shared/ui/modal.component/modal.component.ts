import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-modal',
  styleUrl: './modal.component.scss',
  templateUrl: './modal.component.html',
})
export class ModalComponent implements AfterViewInit, OnChanges {
  @Input() open = false;
  @Input() title = '';

  @Output() closed = new EventEmitter<void>();

  @ViewChild('dialog')
  private dialog?: ElementRef<HTMLDialogElement>;

  ngOnChanges(_changes: SimpleChanges): void {
    this.syncDialog();
  }

  ngAfterViewInit(): void {
    this.syncDialog();
  }

  requestClose(): void {
    this.dialog?.nativeElement.close();
  }

  closeOnBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog?.nativeElement) {
      this.requestClose();
    }
  }

  onDialogClosed(): void {
    if (this.open) {
      this.closed.emit();
    }
  }

  private syncDialog(): void {
    const element = this.dialog?.nativeElement;

    if (!element) return;

    if (this.open && !element.open) {
      element.showModal();
    } else if (!this.open && element.open) {
      element.close();
    }
  }
}
