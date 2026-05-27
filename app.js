const { useState, useMemo, useEffect, useCallback } = React;

// Subject colors with OKLCH
const SUBJECTS = {
  BIOL: { name: 'Biology', color: 'oklch(52% 0.13 150)', tint: 'oklch(96% 0.025 150)' },
  CHEM: { name: 'Chemistry', color: 'oklch(58% 0.14 40)', tint: 'oklch(96% 0.03 40)' },
  PHYS: { name: 'Physics', color: 'oklch(48% 0.17 300)', tint: 'oklch(96% 0.03 300)' },
  MATH: { name: 'Mathematics', color: 'oklch(45% 0.16 255)', tint: 'oklch(96% 0.025 255)' },
  ENGL: { name: 'English', color: 'oklch(58% 0.12 80)', tint: 'oklch(96% 0.04 85)' },
  FREN: { name: 'French', color: 'oklch(55% 0.14 30)', tint: 'oklch(96% 0.03 30)' },
  HUMA: { name: 'Humanities', color: 'oklch(48% 0.14 340)', tint: 'oklch(96% 0.03 340)' },
  PHIL: { name: 'Philosophy', color: 'oklch(42% 0.06 240)', tint: 'oklch(96% 0.015 240)' },
  PHED: { name: 'Phys. Ed.', color: 'oklch(52% 0.12 195)', tint: 'oklch(96% 0.025 195)' },
  COMP: { name: 'Computer Science', color: 'oklch(50% 0.14 220)', tint: 'oklch(96% 0.025 220)' },
  PSYC: { name: 'Psychology', color: 'oklch(55% 0.15 10)', tint: 'oklch(96% 0.03 10)' },
  HIST: { name: 'History', color: 'oklch(48% 0.11 25)', tint: 'oklch(96% 0.025 25)' },
  ECON: { name: 'Economics', color: 'oklch(50% 0.12 175)', tint: 'oklch(96% 0.025 175)' },
  GEOG: { name: 'Geography', color: 'oklch(50% 0.1 120)', tint: 'oklch(96% 0.02 120)' },
  SOCI: { name: 'Sociology', color: 'oklch(52% 0.13 280)', tint: 'oklch(96% 0.025 280)' },
  POLI: { name: 'Political Science', color: 'oklch(48% 0.12 60)', tint: 'oklch(96% 0.025 60)' },
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAY_MAP = { 'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 'Friday': 4 };
const DAY_START = 8 * 60;
const DAY_END = 18 * 60;
const SLOT_MIN = 30;
const SLOTS = (DAY_END - DAY_START) / SLOT_MIN;

// Icons
const IconSearch = () => (
  React.createElement('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5', className: 'icon' },
    React.createElement('circle', { cx: '7', cy: '7', r: '5' }),
    React.createElement('path', { d: 'M11 11l3 3', strokeLinecap: 'round' })
  )
);

const IconChevron = ({ dir = 'right' }) => (
  React.createElement('svg', {
    width: '14', height: '14', viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor',
    strokeWidth: '1.75', strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { transform: dir === 'left' ? 'scaleX(-1)' : 'none' }
  },
    React.createElement('path', { d: 'M6 4l4 4-4 4' })
  )
);

const IconCal = () => (
  React.createElement('svg', {
    width: '22', height: '22', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round'
  },
    React.createElement('rect', { x: '3.5', y: '5', width: '17', height: '15', rx: '2' }),
    React.createElement('path', { d: 'M3.5 10h17M8 3v4M16 3v4' })
  )
);

function fmtTime(min) {
  const h = Math.floor(min / 60), m = min % 60;
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtRange(s, e) {
  return `${fmtTime(s)} - ${fmtTime(e)}`;
}

function timeStrToMin(timeStr) {
  const h = parseInt(timeStr.substring(0, 2));
  const m = parseInt(timeStr.substring(2, 4));
  return h * 60 + m;
}

function getSubject(discipline) {
  return SUBJECTS[discipline] || { name: discipline, color: 'oklch(50% 0.1 200)', tint: 'oklch(96% 0.02 200)' };
}

// Transform loaded JSON data to app format
function transformData(data) {
  const courses = [];
  const teacherSet = new Set();

  for (const course of data.courses) {
    const sections = [];
    for (const section of course.sections) {
      const meetings = [];
      const teachers = new Set();

      for (const comp of section.components) {
        teachers.add(comp.teacher);
        teacherSet.add(comp.teacher);

        for (const dayName of comp.days) {
          const day = DAY_MAP[dayName];
          if (day !== undefined && comp.time) {
            meetings.push({
              day,
              start: timeStrToMin(comp.time.start),
              end: timeStrToMin(comp.time.end),
              type: comp.type,
            });
          }
        }
      }

      sections.push({
        id: section.section,
        teacher: Array.from(teachers).join(', '),
        teachers: Array.from(teachers),
        meetings,
        blended: section.blended || false,
      });
    }

    if (sections.length > 0) {
      courses.push({
        code: `${course.discipline} ${course.course_code}`,
        subject: course.discipline,
        name: course.course_title,
        sections,
      });
    }
  }

  return { courses, teachers: Array.from(teacherSet).sort() };
}

// Schedule generator
function generateSchedules(selectedCodes, teacherPrefs, courses) {
  const selectedCourses = selectedCodes.map(c => courses.find(x => x.code === c)).filter(Boolean);
  const results = [];

  const overlap = (a, b) => a.day === b.day && a.start < b.end && b.start < a.end;

  const conflicts = (picked, sec) => {
    for (const p of picked) {
      for (const m1 of p.section.meetings) {
        for (const m2 of sec.meetings) {
          if (overlap(m1, m2)) return true;
        }
      }
    }
    return false;
  };

  const walk = (i, picked) => {
    if (results.length >= 100) return;
    if (i === selectedCourses.length) {
      results.push({ sections: picked.map(p => ({ ...p })) });
      return;
    }

    const course = selectedCourses[i];
    const prefList = teacherPrefs[course.code] || [];

    let sections = course.sections;
    if (prefList.length > 0) {
      sections = course.sections.filter(s =>
        s.teachers.some(t => prefList.includes(t))
      );
      if (sections.length === 0) sections = course.sections;
    }

    for (const sec of sections) {
      if (conflicts(picked, sec)) continue;
      picked.push({ course, section: sec });
      walk(i + 1, picked);
      picked.pop();
    }
  };

  walk(0, []);
  return results;
}

// Components
function Brand() {
  return React.createElement('div', { className: 'brand' },
    React.createElement('div', { className: 'brand-mark' }, 'J'),
    React.createElement('div', { className: 'brand-text' },
      React.createElement('div', { className: 'wordmark' }, 'Schedule ', React.createElement('em', null, 'Maker')),
      React.createElement('div', { className: 'meta' }, 'John Abbott College \u00b7 Fall 2026')
    )
  );
}

function TopStats({ courses, teachers, results }) {
  return React.createElement('div', { className: 'topbar-stats' },
    React.createElement('div', { className: 'stat' },
      React.createElement('div', { className: 'v' }, courses),
      React.createElement('div', { className: 'l' }, 'Courses')
    ),
    React.createElement('div', { className: 'stat' },
      React.createElement('div', { className: 'v' }, teachers),
      React.createElement('div', { className: 'l' }, 'Teachers')
    ),
    React.createElement('div', { className: 'stat' },
      React.createElement('div', { className: 'v' }, results),
      React.createElement('div', { className: 'l' }, 'Valid Schedules')
    )
  );
}

function CourseRow({ course, selected, onToggle }) {
  const sub = getSubject(course.subject);
  return React.createElement('div', {
    className: 'course-row',
    'data-selected': selected ? '1' : '0',
    style: { '--c': sub.color },
    onClick: () => onToggle(course.code)
  },
    React.createElement('div', { className: 'stripe' }),
    React.createElement('div', { className: 'body' },
      React.createElement('div', { className: 'code' }, course.code),
      React.createElement('div', { className: 'name' }, course.name),
      React.createElement('div', { className: 'meta' }, `${sub.name} \u00b7 ${course.sections.length} sections`)
    ),
    React.createElement('div', { className: 'badge' }, course.sections.length)
  );
}

function SidebarCourses({ query, setQuery, selected, onToggle, courses }) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      getSubject(c.subject).name.toLowerCase().includes(q)
    );
  }, [query, courses]);

  return React.createElement('div', { className: 'panel' },
    React.createElement('div', { className: 'panel-head' },
      React.createElement('h2', null, 'Select courses'),
      React.createElement('span', { className: 'pill' }, `${filtered.length} shown`)
    ),
    React.createElement('div', { className: 'search' },
      React.createElement(IconSearch),
      React.createElement('input', {
        placeholder: 'Search by code, name, or subject...',
        value: query,
        onChange: (e) => setQuery(e.target.value)
      })
    ),
    React.createElement('div', { className: 'course-list' },
      filtered.map(c => React.createElement(CourseRow, {
        key: c.code,
        course: c,
        selected: selected.includes(c.code),
        onToggle
      }))
    )
  );
}

function SelectedChips({ selected, onRemove, courses }) {
  return React.createElement('div', { className: 'chip-area' },
    React.createElement('div', { className: 'chip-area-h' }, `Selected - ${selected.length}`),
    selected.length === 0
      ? React.createElement('div', { className: 'chips-empty' }, 'Pick courses above to start.')
      : React.createElement('div', { className: 'chips' },
          selected.map(code => {
            const course = courses.find(c => c.code === code);
            if (!course) return null;
            const sub = getSubject(course.subject);
            return React.createElement('span', { key: code, className: 'chip', style: { '--c': sub.color } },
              React.createElement('span', { className: 'dot' }),
              code,
              React.createElement('button', { onClick: () => onRemove(code) }, '\u00d7')
            );
          })
        )
  );
}

function TeacherPrefs({ selected, prefs, toggleTeacher, clearPrefs, courses }) {
  if (selected.length === 0) return null;

  return React.createElement('div', { className: 'panel' },
    React.createElement('div', { className: 'panel-head' },
      React.createElement('h2', null, 'Teacher preferences'),
      React.createElement('span', { className: 'pill' }, 'Optional \u00b7 multi-select')
    ),
    React.createElement('div', { className: 'pref-list' },
      selected.map(code => {
        const course = courses.find(c => c.code === code);
        if (!course) return null;
        const sub = getSubject(course.subject);

        const teacherSet = new Set();
        course.sections.forEach(s => s.teachers.forEach(t => teacherSet.add(t)));
        const teachers = Array.from(teacherSet).sort();

        const picked = prefs[code] || [];
        const hint = picked.length === 0
          ? `Any of ${teachers.length}`
          : `${picked.length} of ${teachers.length} preferred`;

        return React.createElement('div', { className: 'pref-row', key: code },
          React.createElement('div', { className: 'pref-head' },
            React.createElement('div', { className: 'pref-code' },
              React.createElement('span', { className: 'dot', style: { background: sub.color } }),
              code
            ),
            React.createElement('div', { className: 'pref-hint' },
              hint,
              picked.length > 0 && React.createElement('button', {
                className: 'pref-clear',
                onClick: () => clearPrefs(code)
              }, 'clear')
            )
          ),
          React.createElement('div', { className: 'teacher-chips' },
            teachers.map(tch => {
              const on = picked.includes(tch);
              return React.createElement('button', {
                key: tch,
                type: 'button',
                className: 'teacher-chip',
                'data-on': on ? '1' : '0',
                style: { '--c': sub.color },
                onClick: () => toggleTeacher(code, tch)
              },
                React.createElement('span', { className: 'check' },
                  React.createElement('svg', { viewBox: '0 0 12 12', width: '10', height: '10' },
                    React.createElement('path', {
                      d: 'M2.5 6.2 5 8.6 9.5 3.6',
                      fill: 'none',
                      stroke: 'currentColor',
                      strokeWidth: '1.8',
                      strokeLinecap: 'round',
                      strokeLinejoin: 'round'
                    })
                  )
                ),
                tch
              );
            })
          )
        );
      })
    )
  );
}

function ScheduleGrid({ days, blocks, slotH }) {
  const cells = [];

  cells.push(React.createElement('div', { className: 'corner', key: 'corner', style: { gridRow: 1, gridColumn: 1 } }));

  days.forEach((d, di) => {
    cells.push(React.createElement('div', {
      className: 'day-h',
      key: `h-${d}`,
      style: { gridRow: 1, gridColumn: di + 2 }
    }, DAY_NAMES[d]));
  });

  for (let i = 0; i < SLOTS; i++) {
    const min = DAY_START + i * SLOT_MIN;
    const isHour = min % 60 === 0;
    cells.push(React.createElement('div', {
      className: 'time-cell',
      key: `t-${i}`,
      style: { gridRow: i + 2, gridColumn: 1 }
    }, isHour ? fmtTime(min) : ''));

    days.forEach((d, di) => {
      cells.push(React.createElement('div', {
        className: `day-cell${isHour ? '' : ' half-hour'}`,
        key: `c-${i}-${d}`,
        style: { gridRow: i + 2, gridColumn: di + 2 }
      }));
    });
  }

  const blockElements = blocks.map((b, i) => {
    const dayCol = days.indexOf(b.day);
    if (dayCol < 0) return null;
    const startSlot = (b.start - DAY_START) / SLOT_MIN;
    const slotSpan = (b.end - b.start) / SLOT_MIN;
    const sub = getSubject(b.course.subject);
    const dur = b.end - b.start;
    const compact = dur <= 30;

    return React.createElement('div', {
      key: i,
      className: `block${compact ? ' compact' : ''}`,
      style: {
        gridColumn: dayCol + 2,
        gridRow: `${startSlot + 2} / span ${slotSpan}`,
        '--c': sub.color,
        '--c-tint': sub.tint,
        margin: '2px'
      },
      title: `${b.course.code} \u00b7 ${b.section.teacher}`
    },
      React.createElement('div', { className: 'b-time' },
        React.createElement('span', null, fmtRange(b.start, b.end)),
        React.createElement('span', { className: 'type-tag' }, b.type[0])
      ),
      React.createElement('div', { className: 'b-code' }, b.course.code),
      React.createElement('div', { className: 'b-name' }, b.course.name, b.section.blended ? ' (Blended)' : ''),
      React.createElement('div', { className: 'b-meta' },
        React.createElement('span', { className: 'teacher' }, b.section.teacher)
      )
    );
  });

  return React.createElement('div', {
    className: 'grid',
    style: { '--rows': SLOTS, '--slot-h': slotH + 'px', '--day-count': days.length }
  }, cells, blockElements);
}

function SectionDetails({ schedule }) {
  return React.createElement('div', { className: 'panel' },
    React.createElement('div', { className: 'details-head' },
      React.createElement('h3', null, 'Section details')
    ),
    React.createElement('div', { className: 'details-list' },
      schedule.sections.map(({ course, section }) => {
        const sub = getSubject(course.subject);
        return React.createElement('div', {
          className: 'detail-card',
          key: course.code,
          style: { '--c': sub.color }
        },
          React.createElement('div', { className: 'row-1' },
            React.createElement('span', { className: 'code' }, course.code)
          ),
          React.createElement('div', { className: 'name' }, course.name, section.blended ? ' (Blended)' : ''),
          React.createElement('div', { className: 'teach' }, `Section ${section.id} \u00b7 ${section.teacher}`),
          React.createElement('div', { className: 'meetings' },
            section.meetings.map((m, i) =>
              React.createElement('div', { className: 'meet-line', key: i },
                React.createElement('span', { className: 'day' }, DAY_NAMES[m.day]),
                React.createElement('span', null, `${fmtRange(m.start, m.end)} \u00b7 ${m.type}`)
              )
            )
          )
        );
      })
    )
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [prefs, setPrefs] = useState({});
  const [scheduleIdx, setScheduleIdx] = useState(0);

  useEffect(() => {
    fetch('schedule_data.json')
      .then(r => r.json())
      .then(data => {
        const { courses, teachers } = transformData(data);
        setCourses(courses);
        setAllTeachers(teachers);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load data:', err);
        setLoading(false);
      });
  }, []);

  const toggleCourse = useCallback(code => {
    setSelected(s => s.includes(code) ? s.filter(x => x !== code) : [...s, code]);
    setScheduleIdx(0);
  }, []);

  const removeCourse = useCallback(code => {
    setSelected(s => s.filter(x => x !== code));
    setPrefs(p => { const { [code]: _, ...rest } = p; return rest; });
    setScheduleIdx(0);
  }, []);

  const toggleTeacher = useCallback((code, teacher) => {
    setPrefs(p => {
      const cur = p[code] || [];
      const next = cur.includes(teacher)
        ? cur.filter(x => x !== teacher)
        : [...cur, teacher];
      return { ...p, [code]: next };
    });
    setScheduleIdx(0);
  }, []);

  const clearPrefs = useCallback(code => {
    setPrefs(p => ({ ...p, [code]: [] }));
    setScheduleIdx(0);
  }, []);

  const schedules = useMemo(
    () => generateSchedules(selected, prefs, courses),
    [selected, prefs, courses]
  );
  const current = schedules[scheduleIdx];
  const days = [0, 1, 2, 3, 4];
  const slotH = 36;

  const blocks = useMemo(() => {
    if (!current) return [];
    const out = [];
    for (const { course, section } of current.sections) {
      for (const m of section.meetings) {
        out.push({ ...m, course, section });
      }
    }
    return out;
  }, [current]);

  useEffect(() => {
    if (scheduleIdx >= schedules.length) {
      setScheduleIdx(Math.max(0, schedules.length - 1));
    }
  }, [schedules.length, scheduleIdx]);

  useEffect(() => {
    const h = e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft' && scheduleIdx > 0) setScheduleIdx(scheduleIdx - 1);
      if (e.key === 'ArrowRight' && scheduleIdx < schedules.length - 1) setScheduleIdx(scheduleIdx + 1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [scheduleIdx, schedules.length]);

  if (loading) {
    return React.createElement('div', { className: 'app' },
      React.createElement('header', { className: 'topbar' }, React.createElement(Brand)),
      React.createElement('div', { style: { padding: 40, textAlign: 'center', color: 'var(--muted)' } },
        'Loading schedule data...'
      )
    );
  }

  return React.createElement('div', { className: 'app' },
    React.createElement('header', { className: 'topbar' },
      React.createElement(Brand),
      React.createElement('div', { className: 'topbar-spacer' }),
      React.createElement(TopStats, { courses: courses.length, teachers: allTeachers.length, results: schedules.length })
    ),
    React.createElement('div', { className: 'layout' },
      React.createElement('aside', { className: 'sidebar' },
        React.createElement(SidebarCourses, { query, setQuery, selected, onToggle: toggleCourse, courses }),
        React.createElement('div', { className: 'panel' },
          React.createElement(SelectedChips, { selected, onRemove: removeCourse, courses })
        ),
        React.createElement(TeacherPrefs, { selected, prefs, toggleTeacher, clearPrefs, courses })
      ),
      React.createElement('main', { className: 'main' },
        React.createElement('div', { className: 'panel' },
          React.createElement('div', { className: 'schedule-head' },
            React.createElement('div', { className: 'left' },
              React.createElement('h2', null, 'Your schedule'),
              React.createElement('div', { className: 'result-count' },
                schedules.length === 0
                  ? React.createElement('span', null, 'No valid schedules - try removing a course or teacher pin.')
                  : React.createElement('span', null,
                      React.createElement('strong', null, schedules.length),
                      ` valid arrangement${schedules.length === 1 ? '' : 's'}`
                    )
              )
            ),
            schedules.length > 0 && React.createElement('div', { className: 'nav-cluster' },
              React.createElement('button', {
                onClick: () => setScheduleIdx(Math.max(0, scheduleIdx - 1)),
                disabled: scheduleIdx === 0
              }, React.createElement(IconChevron, { dir: 'left' })),
              React.createElement('div', { className: 'index-pill' }, `${scheduleIdx + 1} / ${schedules.length}`),
              React.createElement('button', {
                onClick: () => setScheduleIdx(Math.min(schedules.length - 1, scheduleIdx + 1)),
                disabled: scheduleIdx >= schedules.length - 1
              }, React.createElement(IconChevron)),
              schedules.length <= 12 && React.createElement('div', { className: 'dots' },
                schedules.map((_, i) => React.createElement('i', {
                  key: i,
                  'data-active': i === scheduleIdx ? '1' : '0',
                  onClick: () => setScheduleIdx(i)
                }))
              )
            )
          ),
          React.createElement('div', { className: 'grid-wrap' },
            schedules.length === 0
              ? React.createElement('div', { className: 'empty' },
                  React.createElement('div', { className: 'empty-mark' }, React.createElement(IconCal)),
                  React.createElement('h3', null, 'Nothing fits - yet.'),
                  React.createElement('p', null,
                    selected.length === 0
                      ? 'Choose a few courses from the left to generate a schedule.'
                      : 'Your current selection and teacher pins conflict. Try loosening a constraint.'
                  )
                )
              : React.createElement(ScheduleGrid, { days, blocks, slotH })
          )
        ),
        current && React.createElement(SectionDetails, { schedule: current })
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
