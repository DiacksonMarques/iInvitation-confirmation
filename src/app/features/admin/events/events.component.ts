import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ModalComponent } from '../../../shared/ui/modal.component/modal.component';
import { Event, EventInput } from './events.models';
import { EventService } from './events.service';
import { AlertService } from '../../../core/services/alert.service';
import { RouterLink, Router } from '@angular/router';

function deadlineBeforeEventDate(control: AbstractControl): ValidationErrors | null {
  const eventDate = control.get('event_date')?.value;
  const deadline = control.get('confirmation_deadline')?.value;

  if (!eventDate || !deadline) return null;

  return new Date(deadline) > new Date(eventDate) ? { deadlineAfterEvent: true } : null;
}

@Component({
  imports: [DatePipe, ModalComponent, ReactiveFormsModule, RouterLink],
  selector: 'app-events',
  styleUrl: './events.component.scss',
  templateUrl: './events.component.html',
})
export class EventsComponent implements OnInit{
  private readonly formBuilder = inject(FormBuilder);
  private readonly eventService = inject(EventService);
  private readonly alerts = inject(AlertService);
  private readonly router = inject(Router);

  protected events = signal<Event[]>([]);
  protected isLoadingEvents = signal(true);
  protected isEventModalOpen = signal(false);
  protected isSaving = signal(false);
  protected editingEvent: WritableSignal<Event | null> = signal(null);
  protected deletingEventId = signal<string | null>(null);

  protected readonly eventForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.maxLength(120)]],
      description: [''],
      event_date: ['', Validators.required],
      confirmation_deadline: [''],
      location: [''],
      invitation_message: [''],
      status: ['draft' as Event['status'], Validators.required],
    },
    {
      validators: deadlineBeforeEventDate
  });

  async ngOnInit() {
    this.loadEvents();
  }

  private async loadEvents(): Promise<void> {
    this.isLoadingEvents.set(true);
    let failed = false;

    try {
      this.events.set(await this.eventService.findAll());
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      failed = true;
    } finally {
      this.isLoadingEvents.set(false);
    }

    if (failed) {
      await this.alerts.error('Não foi possível carregar os eventos.');
    }
  }

  protected statusLabel(status: Event['status']): string {
    const labels: Record<Event['status'], string> = {
      draft: 'Pendente',
      active: 'Ativo',
      closed: 'Encerrado',
    };

    return labels[status];
  }

  protected openCreateModal(): void {
    this.editingEvent.set(null);
    this.eventForm.reset({
      name: '',
      description: '',
      event_date: '',
      confirmation_deadline: '',
      location: '',
      invitation_message: '',
      status: 'draft',
    });
    this.isEventModalOpen.set(true);
  }

  protected openEditModal(event: Event): void {
    this.editingEvent.set(event);
    this.eventForm.reset({
      name: event.name,
      description: event.description ?? '',
      event_date: this.toDateTimeLocal(event.event_date),
      confirmation_deadline: event.confirmation_deadline ? this.toDateTimeLocal(event.confirmation_deadline) : '',
      location: event.location ?? '',
      invitation_message: event.invitation_message ?? '',
      status: event.status,
    });
    this.isEventModalOpen.set(true);
  }

  protected closeEventModal(): void {
    this.isEventModalOpen.set(false);
    this.editingEvent.set(null);
  }

  protected async submitEventForm(): Promise<void> {
    this.eventForm.markAllAsTouched();

    if (this.eventForm.invalid || this.isSaving()) return;

    const values = this.eventForm.getRawValue() as Event;

    const input: EventInput = {
      name: values.name.trim(),
      description: values.description?.trim() || null,
      event_date: new Date(values.event_date).toISOString(),
      confirmation_deadline: values.confirmation_deadline ? new Date(values.confirmation_deadline).toISOString() : null,
      location: values.location?.trim() || null,
      invitation_message: values.invitation_message?.trim() || null,
      status: values.status,
    };

    this.isSaving.set(true);
    let falid = false;

    try {
      if (this.editingEvent()) {
        await this.eventService.update(this.editingEvent()?.id ?? '', input);
        await this.alerts.success('Evento atualizado com sucesso.', true);
      } else {
        const createdEvent = await this.eventService.create(input);
        this.closeEventModal();
        await this.router.navigate(['/admin/eventos', createdEvent.id]);
        return;
      }

      this.closeEventModal();
      await this.loadEvents();
    } catch (error) {
      console.error('Erro ao salvar evento:', error);
      falid = true;
    } finally {
      this.isSaving.set(false);
    }

    if(falid){
      await this.alerts.error('Não foi possível salvar o evento.', true);
    }
  }

  protected async deleteEvent(event: Event): Promise<void> {
    if (this.deletingEventId()) return;

    const confirmation = await this.alerts.confirm(
      `Tem certeza que deseja excluir "${event.name}"? Esta ação não pode ser desfeita.`,
      false,
      'Excluir evento?',
    );

    if (!confirmation.isConfirmed) return;

    this.deletingEventId.set(event.id);
    let failed = false;

    try {
      await this.eventService.remove(event.id);

      this.events.update((events) => events.filter((item) => item.id !== event.id));
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
      failed = true;
    } finally {
      this.deletingEventId.set(null);
    }

    if (failed) {
      await this.alerts.error('Não foi possível excluir. O evento pode ter convites ou presentes associados.');
      return;
    }

    await this.alerts.success('Evento excluído com sucesso.');
  }

  private toDateTimeLocal(value: string): string {
    const date = new Date(value);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

    return localDate.toISOString().slice(0, 16);
  }
}
