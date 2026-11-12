import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AlertService } from '../../../core/services/alert.service';
import { Event } from '../events/events.models';
import { EventService } from '../events/events.service';
import {
  DashboardService,
  EventDashboardSummary,
  GuestInvitationStatus,
} from './dashboard.service';

@Component({
  imports: [DatePipe, FormsModule, RouterLink],
  selector: 'app-dashboard',
  styleUrl: './dashboard.component.scss',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  private readonly eventService = inject(EventService);
  private readonly dashboardService = inject(DashboardService);
  private readonly alerts = inject(AlertService);

  protected events = signal<Event[]>([]);
  protected selectedEventId = signal('');
  protected summary = signal<EventDashboardSummary | null>(null);

  protected isLoadingEvents = signal(true);
  protected isLoadingSummary = signal(false);
  protected eventsLoadError = signal(false);
  protected summaryLoadError = signal(false);

  async ngOnInit(): Promise<void> {
    await this.loadEvents();
  }

  protected selectedEvent(): Event | undefined {
    return this.events().find(
      (event) => event.id === this.selectedEventId(),
    );
  }

  protected async onEventChange(eventId: string): Promise<void> {
    this.selectedEventId.set(eventId);
    await this.loadSummary();
  }

  protected async loadEvents(): Promise<void> {
    this.isLoadingEvents.set(true);
    this.eventsLoadError.set(false);

    try {
      const events = await this.eventService.findAll();
      const availableEvents = events.filter((event) => !event.archived_at);

      this.events.set(availableEvents);

      const firstEvent = availableEvents[0];

      if (firstEvent) {
        this.selectedEventId.set(firstEvent.id);
        await this.loadSummary();
      } else {
        this.selectedEventId.set('');
        this.summary.set(null);
      }
    } catch (error) {
      console.error('Erro ao carregar eventos para o dashboard:', error);
      this.eventsLoadError.set(true);
      await this.alerts.error('Não foi possível carregar os eventos.');
    } finally {
      this.isLoadingEvents.set(false);
    }
  }

  protected async loadSummary(): Promise<void> {
    const eventId = this.selectedEventId();

    if (!eventId) {
      this.summary.set(null);
      return;
    }

    this.isLoadingSummary.set(true);
    this.summaryLoadError.set(false);

    try {
      this.summary.set(
        await this.dashboardService.getEventSummary(eventId),
      );
    } catch (error) {
      console.error('Erro ao carregar resumo do evento:', error);
      this.summaryLoadError.set(true);
      this.summary.set(null);
      await this.alerts.error(
        'Não foi possível carregar os dados deste evento.',
      );
    } finally {
      this.isLoadingSummary.set(false);
    }
  }

  protected statusLabel(status: GuestInvitationStatus): string {
    const labels: Record<GuestInvitationStatus, string> = {
      pending: 'Pendente',
      confirmed: 'Confirmado',
      declined: 'Recusado',
    };

    return labels[status];
  }
}
