import {
  at,
  desiredNotifications,
  keyOf,
  reconcile,
  shiftOutOfQuiet,
  type NotifySession,
  type NotifySettings,
} from '../reconcile';

const settings: NotifySettings = {
  enabled: true,
  sessions: true,
  sessionOffset: 15,
  running: true,
  nudge: true,
  nudgeTime: '09:00',
  missed: true,
  weight: false,
  weightTime: '07:30',
  weightDays: [0, 1, 2, 3, 4, 5, 6],
  measurement: false,
  measurementDay: 0,
  measurementTime: '07:30',
  photo: false,
  photoTime: '08:00',
  photoAnchor: null,
  weekly: false,
  backup: false,
  backupLastAt: null,
  quietStart: '22:00',
  quietEnd: '07:00',
};
const t = (k: string, v?: Record<string, string | number>) => `${k}${v ? JSON.stringify(v) : ''}`;
const NOW = at('2026-09-26', '08:00'); // Saturday
const s = (over: Partial<NotifySession>): NotifySession => ({
  id: 'gym',
  date: '2026-09-26',
  startTime: '18:00',
  type: 'gym',
  status: 'planned',
  title: 'Upper Body',
  reminderOffsetMinutes: null,
  ...over,
});

describe('desiredNotifications', () => {
  it('master off → none', () => {
    expect(desiredNotifications({ ...settings, enabled: false }, [s({})], NOW, t)).toEqual([]);
  });

  it('18:00 session with a 15 min reminder → 17:45; per-session override; moved session → new time', () => {
    const [d] = desiredNotifications(settings, [s({})], NOW, t);
    expect(d).toMatchObject({
      kind: 'session',
      targetId: 'gym',
      fireAt: at('2026-09-26', '17:45'),
      url: '/session/gym',
    });
    expect(
      desiredNotifications(settings, [s({ reminderOffsetMinutes: 60 })], NOW, t)[0]!.fireAt,
    ).toBe(at('2026-09-26', '17:00'));
    const moved = desiredNotifications(settings, [s({ startTime: '19:00' })], NOW, t)[0]!;
    const plan = reconcile(
      [moved],
      [
        {
          osNotificationId: 'os1',
          kind: 'session',
          targetId: 'gym',
          fireAt: new Date(d!.fireAt).toISOString(),
        },
      ],
    );
    expect(plan.toCancel.map((e) => e.osNotificationId)).toEqual(['os1']);
    expect(plan.toSchedule[0]!.fireAt).toBe(at('2026-09-26', '18:45'));
  });

  it('completed session → its reminder is cancelled; reconcile is idempotent', () => {
    const d = desiredNotifications(settings, [s({})], NOW, t);
    const existing = d.map((x, i) => ({
      osNotificationId: `os${i}`,
      kind: x.kind,
      targetId: x.targetId,
      fireAt: new Date(x.fireAt).toISOString(),
    }));
    expect(reconcile(d, existing)).toEqual({ toSchedule: [], toCancel: [] });
    const after = desiredNotifications(settings, [s({ status: 'completed' })], NOW, t);
    expect(reconcile(after, existing).toCancel).toHaveLength(1);
  });

  it('untimed nudge, missed follow-up next morning, running toggle, past reminders skipped', () => {
    const r = desiredNotifications(
      { ...settings, running: false },
      [
        s({ id: 'abs', startTime: null, date: '2026-09-27' }),
        s({ id: 'leg', date: '2026-09-25' }),
        s({ id: 'run', type: 'running' }),
        s({ id: 'early', startTime: '08:05' }),
      ],
      NOW,
      t,
    );
    expect(r.map((d) => d.targetId).sort()).toEqual(['missed:leg', 'nudge:2026-09-27'].sort());
    // The missed follow-up for yesterday fires today at 09:00 (> now).
    expect(r.find((d) => d.targetId === 'missed:leg')!.fireAt).toBe(at('2026-09-26', '09:00'));
  });

  it('quiet hours shift non-timed reminders; body reminders and weekly summary', () => {
    expect(shiftOutOfQuiet(at('2026-09-26', '23:30'), '22:00', '07:00')).toBe(
      at('2026-09-27', '07:00'),
    );
    expect(shiftOutOfQuiet(at('2026-09-26', '05:00'), '22:00', '07:00')).toBe(
      at('2026-09-26', '07:00'),
    );
    expect(shiftOutOfQuiet(at('2026-09-26', '12:00'), '22:00', '07:00')).toBe(
      at('2026-09-26', '12:00'),
    );
    const r = desiredNotifications(
      {
        ...settings,
        sessions: false,
        nudge: false,
        missed: false,
        weight: true,
        weightTime: '06:00',
        weightDays: [0],
        measurement: true,
        weekly: true,
        photo: true,
        photoAnchor: '2026-09-15',
      },
      [s({ date: '2026-09-29' })],
      NOW,
      t,
    );
    const weight = r.find((d) => d.kind === 'weight')!;
    expect(weight.fireAt).toBe(at('2026-09-27', '07:00')); // 06:00 is in quiet hours
    expect(r.find((d) => d.kind === 'measurement')!.fireAt).toBe(at('2026-09-27', '07:30'));
    expect(r.find((d) => d.kind === 'weekly_summary')!.title).toBe('weekly{"count":1}');
    expect(r.filter((d) => d.kind === 'photo').map((d) => d.targetId)).toEqual([
      'photo:2026-09-29',
    ]);
    expect(r.every((d) => !/\\d+(\\.\\d+)? ?kg/.test(d.title + d.body))).toBe(true); // no sensitive values
    expect(keyOf(weight)).toContain('weight|weight:2026-09-27|');
  });

  it('caps at 50, sessions first', () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      s({
        id: `s${i}`,
        startTime: `${String(9 + (i % 12)).padStart(2, '0')}:00`,
        date: `2026-09-${27 + (i % 4)}`,
      }),
    );
    const r = desiredNotifications({ ...settings, weight: true }, many, NOW, t);
    expect(r).toHaveLength(50);
    expect(r.every((d) => d.kind === 'session')).toBe(true);
  });
});
