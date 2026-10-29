// This week's picks, shared by kit.html (posts) and reel.html (reel). Edit this file each week.
// post / story / reel: false leaves an event out of that format (the post fits 5, the story 7, the reel ~6).
// cat: music | food | arts | night | sports | fitness. Always check each event's own page before posting.
window.YARD_WEEK = {
  label: 'Halloween weekend · Oct 30 – Nov 1',
  days: [
    ['Fri', [
      { time: '8:00 PM', title: 'The Renaissance Orchestra', venue: 'The Fillmore', cat: 'music', post: false, story: false, reel: false },
      { time: '9:00 PM', title: 'It’s a 2000s Halloween Party', venue: 'The Underground', cat: 'night' },
    ]],
    ['Sat', [
      { time: '11:00 AM', title: 'Sip Happens: Drag Brunch', venue: 'NoDa Brewing Company', cat: 'food' },
      { time: '1:00 PM', title: 'Charlotte FC vs. Orlando City', venue: 'Bank of America Stadium', cat: 'sports' },
      { time: '8:00 PM', title: 'Halloween Comedy Show', venue: 'Art Factory', cat: 'arts', post: false },
      { time: '9:00 PM', title: 'sCarrie Prom', venue: 'The Carolina', cat: 'night', post: false, reel: false },
    ]],
    ['Sun', [
      { time: '11:00 AM', title: 'Día de Muertos Festival', venue: 'Camp North End', cat: 'arts' },
      { time: '7:00 PM', title: 'An Evening with David Sedaris', venue: 'Ovens Auditorium', cat: 'arts' },
    ]],
  ],
};
// Brand category colours (DESIGN.md §3; sports is social-only).
window.YARD_CATS = {
  music:   { solid: '#D9722A', soft: '#FDE7D6', label: 'Music' },
  food:    { solid: '#8E6FD1', soft: '#ECE5FA', label: 'Food & Drinks' },
  arts:    { solid: '#B87A30', soft: '#FBEBD6', label: 'Arts & Culture' },
  night:   { solid: '#C9567A', soft: '#FBE1EA', label: 'Nightlife' },
  sports:  { solid: '#2F6FB3', soft: '#DCE8F6', label: 'Sports' },
  fitness: { solid: '#3F8F5F', soft: '#DDF0E3', label: 'Fitness' },
};
