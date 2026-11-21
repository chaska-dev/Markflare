// Calendar page: day, month and year views backed by the /api/events CRUD.
// One fetch per visible year serves all three views. Dates are local
// wall-clock YYYY-MM-DD keys built from the Date parts (never toISOString,
// which would shift the day to UTC).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { api } from '../api/client';
import { CalendarEvent } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { ConfirmDialog } from './ConfirmDialog';
import { CalendarIcon, ChevronLeftIcon, ChevronRightSmallIcon, PlusIcon, XIcon } from './Icons';

type View = 'day' | 'month' | 'year';

const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
// Month/year stepping always lands on day 1 so the cursor stays a valid
// representative of the period (addMonths rolls over long months cleanly).
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const todayKey = toKey(new Date());

// Monday-first 6-row (42-cell) grid for one month, used by both the big month
// view and the mini months in the year view.
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - (first.getDay() + 6) % 7);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

// View and cursor live in the URL (?view=day&date=YYYY-MM-DD) so the browser's
// back/forward buttons move between calendar states the same way they do
// between pages. Invalid or missing params fall back to month view / today.
const VIEWS: View[] = ['day', 'month', 'year'];
function parseView(v: string | null): View {
  return VIEWS.includes(v as View) ? (v as View) : 'month';
}
function parseDate(s: string | null): Date {
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (!isNaN(dt.getTime()) && toKey(dt) === s) return dt;
  }
  return new Date();
}

export function CalendarPage() {
  const { t, language } = useLanguage();
  // URL is the source of truth for view + date, so back/forward work.
  const [params, setParams] = useSearchParams();
  const view = parseView(params.get('view'));
  const cursor = parseDate(params.get('date'));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // null = closed; { event: null } = create on `date`, else edit that event.
  const [modal, setModal] = useState<{ date: string; event: CalendarEvent | null } | null>(null);

  // `replace` for in-place adjustments (prev/next/today), push for view
  // changes and date picks, so back undoes the "navigation" steps first.
  const setUrl = useCallback((nextView: View, nextDate: Date, replace = false) => {
    setParams({ view: nextView, date: toKey(nextDate) }, { replace });
  }, [setParams]);

  const year = cursor.getFullYear();
  const reload = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.events.list(`${year}-01-01`, `${year}-12-31`)
      .then(res => { if (active) setEvents(res.events); })
      .catch(err => {
        console.error('Failed to load events', err);
        if (active) setError(t('calendar.loadError'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  useEffect(() => reload(), [reload]);

  // date -> events for that date (server already sorts within a date).
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.event_date);
      if (list) list.push(e); else map.set(e.event_date, [e]);
    }
    return map;
  }, [events]);

  const step = (dir: number) => {
    if (view === 'day') setUrl(view, addDays(cursor, dir), true);
    else if (view === 'month') setUrl(view, addMonths(cursor, dir), true);
    else setUrl(view, addMonths(cursor, dir * 12), true);
  };

  const openDay = (d: Date) => setUrl('day', d);
  const openMonth = (d: Date) => setUrl('month', new Date(d.getFullYear(), d.getMonth(), 1));

  const locale = language;
  const headerTitle = view === 'day'
    ? new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(cursor)
    : view === 'month'
      ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(cursor)
      : String(year);
  const dayLabel = (d: Date) => new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(d);

  const dayEvents = byDate.get(toKey(cursor)) ?? [];
  const weekdayNames = useMemo(() => {
    // 2024-01-01 is a Monday, so +i walks Mon..Sun in order.
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
  }, [locale]);

  const timeLabel = (e: CalendarEvent) =>
    e.start_time ? (e.end_time ? `${e.start_time} – ${e.end_time}` : e.start_time) : t('calendar.allDay');

  return (
    <div className="calendar-page">
      <header className="calendar-header">
        <h1 className="calendar-title"><CalendarIcon size={18} /> {t('calendar.title')}</h1>
        <div className="calendar-nav">
          <button type="button" className="calendar-nav-btn" onClick={() => step(-1)} aria-label="Previous">
            <ChevronLeftIcon size={16} />
          </button>
          <button type="button" className="calendar-nav-btn calendar-nav-btn--today" onClick={() => setUrl(view, new Date(), true)}>
            {t('calendar.today')}
          </button>
          <button type="button" className="calendar-nav-btn" onClick={() => step(1)} aria-label="Next">
            <ChevronRightSmallIcon size={16} />
          </button>
          <span className="calendar-header-title">{headerTitle}</span>
        </div>
        <div className="calendar-actions">
          <div className="calendar-view-switch" role="tablist">
            {(['day', 'month', 'year'] as View[]).map(v => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                className={`calendar-view-btn ${view === v ? 'active' : ''}`}
                onClick={() => setUrl(v, cursor)}
              >
                {t(`calendar.view${v[0].toUpperCase()}${v.slice(1)}` as const)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="calendar-add-btn"
            onClick={() => setModal({ date: toKey(cursor), event: null })}
          >
            <PlusIcon size={14} /> {t('calendar.newEvent')}
          </button>
        </div>
      </header>

      {error && <div className="calendar-error" role="alert">{error}</div>}

      {loading ? (
        <div className="calendar-empty">…</div>
      ) : view === 'day' ? (
        <div className="calendar-day-list">
          {dayEvents.length === 0 ? (
            <div className="calendar-empty">{t('calendar.noEvents')}</div>
          ) : (
            dayEvents.map(e => (
              <button key={e.id} type="button" className="calendar-event-row" onClick={() => setModal({ date: e.event_date, event: e })}>
                <span className="calendar-event-time">{timeLabel(e)}</span>
                <span className="calendar-event-name">{e.title}</span>
              </button>
            ))
          )}
        </div>
      ) : view === 'month' ? (
        <div className="calendar-month">
          <div className="calendar-weekdays">
            {weekdayNames.map(w => <span key={w} className="calendar-weekday">{w}</span>)}
          </div>
          <div className="calendar-grid">
            {monthGrid(year, cursor.getMonth()).map((d, i) => {
              const key = toKey(d);
              const outside = d.getMonth() !== cursor.getMonth();
              const hasEvents = (byDate.get(key)?.length ?? 0) > 0;
              return (
                <button
                  key={i}
                  type="button"
                  className={`calendar-cell ${outside ? 'calendar-cell--outside' : ''} ${key === todayKey ? 'calendar-cell--today' : ''}`}
                  onClick={() => openDay(d)}
                >
                  <span className="calendar-cell-day">{dayLabel(d)}</span>
                  {hasEvents && <span className="calendar-event-dot" />}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="calendar-year-grid">
          {Array.from({ length: 12 }, (_, m) => (
            <div key={m} className="calendar-minimonth">
              <button type="button" className="calendar-minimonth-title" onClick={() => openMonth(new Date(year, m, 1))}>
                {new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(year, m, 1))}
              </button>
              <div className="calendar-minimonth-weekdays">
                {weekdayNames.map(w => <span key={w}>{w[0]}</span>)}
              </div>
              <div className="calendar-minimonth-grid">
                {monthGrid(year, m).map((d, i) => {
                  const key = toKey(d);
                  const outside = d.getMonth() !== m;
                  const hasEvents = (byDate.get(key)?.length ?? 0) > 0;
                  return hasEvents && !outside ? (
                    <button key={i} type="button" className={`calendar-mini-cell calendar-mini-cell--event ${key === todayKey ? 'calendar-cell--today' : ''}`} onClick={() => openDay(d)}>
                      {dayLabel(d)}
                    </button>
                  ) : (
                    <span key={i} className={`calendar-mini-cell ${outside ? 'calendar-cell--outside' : ''} ${key === todayKey ? 'calendar-cell--today' : ''}`}>
                      {dayLabel(d)}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <EventModal
          initialDate={modal.date}
          event={modal.event}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); reload(); }}
        />
      )}
    </div>
  );
}

// Create/edit modal, shared by every view. `event` null = create.
function EventModal({ initialDate, event, onClose, onSaved }: {
  initialDate: string;
  event: CalendarEvent | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(event?.event_date ?? initialDate);
  const [start, setStart] = useState(event?.start_time ?? '');
  const [end, setEnd] = useState(event?.end_time ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNew = !event;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmDelete) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmDelete, onClose]);

  const save = async () => {
    if (!title.trim()) { setError(t('calendar.titleRequired')); return; }
    if (start && end && end < start) { setError(t('calendar.actionError')); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = { title: title.trim(), event_date: date, start_time: start || null, end_time: end || null };
      if (isNew) await api.events.create(payload);
      else await api.events.update(event.id, payload);
      onSaved();
    } catch (err) {
      console.error('Failed to save event', err);
      setError(t('calendar.actionError'));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!event) return;
    setSaving(true);
    try {
      await api.events.remove(event.id);
      onSaved();
    } catch (err) {
      console.error('Failed to delete event', err);
      setError(t('calendar.actionError'));
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  return createPortal(
    <>
      <div className="event-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !confirmDelete) onClose(); }}>
        <div className="event-modal" role="dialog" aria-modal="true" aria-label={isNew ? t('calendar.newEvent') : t('calendar.editEvent')}>
          <div className="event-modal-header">
            <span className="event-modal-title">
              <CalendarIcon size={15} /> {isNew ? t('calendar.newEvent') : t('calendar.editEvent')}
            </span>
            <button type="button" className="event-modal-close" onClick={onClose} aria-label="Close">
              <XIcon size={15} />
            </button>
          </div>

          <div className="event-modal-body">
            <label className="event-modal-field">
              <span>{t('calendar.eventTitle')}</span>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('calendar.eventTitlePlaceholder')}
                maxLength={500}
              />
            </label>
            <label className="event-modal-field">
              <span>{t('calendar.date')}</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </label>
            <div className="event-modal-times">
              <label className="event-modal-field">
                <span>{t('calendar.startTime')}</span>
                <input type="time" value={start} onChange={e => setStart(e.target.value)} />
              </label>
              <label className="event-modal-field">
                <span>{t('calendar.endTime')}</span>
                <input type="time" value={end} onChange={e => setEnd(e.target.value)} />
              </label>
            </div>
            {!start && <div className="event-modal-hint">{t('calendar.allDay')}</div>}
            {error && <div className="event-modal-error" role="alert">{error}</div>}
          </div>

          <div className="event-modal-footer">
            {!isNew && (
              <button type="button" className="event-modal-delete" onClick={() => setConfirmDelete(true)}>
                {t('calendar.deleteEvent')}
              </button>
            )}
            <button type="button" className="event-modal-cancel" onClick={onClose}>{t('dialog.cancel')}</button>
            <button type="button" className="event-modal-save" onClick={save} disabled={saving}>
              {t('common.save')}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t('calendar.confirmDeleteTitle', { title: event?.title || t('calendar.eventTitlePlaceholder') })}
        description={t('calendar.confirmDeleteBody')}
        confirmLabel={t('calendar.deleteEvent')}
        confirmTone="danger"
        loading={saving}
        onConfirm={remove}
        onCancel={() => { if (!saving) setConfirmDelete(false); }}
      />
    </>,
    document.body
  );
}
