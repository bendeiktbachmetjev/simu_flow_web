// Sections of the admin area, in top-navigation order.
// `usesPeriod` = the page shows the period filter row; the calendar has its own date controls.
export const SECTIONS = [
  { id: 'overview', label: 'Overview', path: '/admin/overview', usesPeriod: true },
  { id: 'calendar', label: 'Calendar', path: '/admin/calendar', usesPeriod: false },
  { id: 'students', label: 'Students', path: '/admin/students', usesPeriod: true },
  { id: 'classes', label: 'Classes', path: '/admin/classes', usesPeriod: true },
  { id: 'simulators', label: 'Simulators', path: '/admin/simulators', usesPeriod: true },
  { id: 'rooms', label: 'Rooms', path: '/admin/rooms', usesPeriod: true },
  { id: 'guests', label: 'Guests', path: '/admin/guests', usesPeriod: true },
];

export const DEFAULT_SECTION = 'overview';

export const isSectionId = (id) => SECTIONS.some((s) => s.id === id);

// '/admin/rooms' → 'rooms'; '/admin', '/admin/' or anything unknown → null.
// Case-insensitive like the router's own matching: '/admin/Calendar' renders the calendar
// route, so it has to resolve to the calendar section here as well.
export const sectionFromPath = (pathname) => {
  const match = /^\/admin\/([^/?#]+)\/?$/i.exec(pathname || '');
  const id = match ? match[1].toLowerCase() : null;
  return id && isSectionId(id) ? id : null;
};
