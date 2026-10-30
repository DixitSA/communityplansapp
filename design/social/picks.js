// This week's picks, shared by kit.html (posts) and reel.html (reel). Edit this file each week.
// post / story / reel: false leaves an event out of that format (the post fits 5, the story 7, the reel ~6).
// cat: music | food | arts | night | sports | fitness. Always check each event's own page before posting.
// image (optional): a URL or a path like 'img/brunch.jpg' (put files in design/social/img/, not committed). credit: shown on the photo.
// Only use photos you have the right to repost: your own, the venue's with permission (tag them), or free-licence stock.
window.YARD_WEEK = {
  label: 'Halloween weekend · Oct 30 – Nov 1',
  days: [
    ['Fri', [
      { time: '8:00 PM', title: 'The Renaissance Orchestra', image: 'https://s1.ticketm.net/dam/a/c03/b7bd6b38-a8d1-46c5-b200-38a96f9a9c03_SOURCE', credit: 'Ticketmaster', venue: 'The Fillmore', cat: 'music', post: false, story: false, reel: false },
      { time: '9:00 PM', title: 'It’s a 2000s Halloween Party', image: 'https://s1.ticketm.net/dam/a/8c5/20f9e939-aa4c-418e-b828-3165542458c5_SOURCE', credit: 'Ticketmaster', venue: 'The Underground', cat: 'night' },
    ]],
    ['Sat', [
      { time: '11:00 AM', title: 'Sip Happens: Drag Brunch', venue: 'NoDa Brewing Company', cat: 'food' },
      { time: '1:00 PM', title: 'Charlotte FC vs. Orlando City', image: 'https://s1.ticketm.net/dam/a/f6e/308835c9-2787-46e7-b887-3fe19dcc6f6e_SOURCE', credit: 'Ticketmaster', venue: 'Bank of America Stadium', cat: 'sports' },
      { time: '8:00 PM', title: 'Halloween Comedy Show', venue: 'Art Factory', cat: 'arts', post: false },
      { time: '9:00 PM', title: 'sCarrie Prom', image: 'https://s1.ticketm.net/dam/e/bdb/0b6e7266-4bc0-4115-9fc6-700af07f0bdb_TABLET_LANDSCAPE_LARGE_16_9.jpg', credit: 'Ticketmaster', venue: 'The Carolina', cat: 'night', post: false, reel: false },
    ]],
    ['Sun', [
      { time: '11:00 AM', title: 'Día de Muertos Festival', venue: 'Camp North End', cat: 'arts' },
      { time: '7:00 PM', title: 'An Evening with David Sedaris', image: 'https://s1.ticketm.net/dam/a/520/fd7e913c-a71d-49a1-9e46-ec5c0b019520_SOURCE', credit: 'Ticketmaster', venue: 'Ovens Auditorium', cat: 'arts' },
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
