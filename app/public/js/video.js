// Video cards: a thumbnail that loads the YouTube player only when tapped (no third-party player,
// cookies or tracking until then), from youtube-nocookie.com. Videos are picked by phase, role and city.
// All are official Lloyds Banking Group / Lloyds Bank uploads.
//
//   import { videosFor, videoCard, mountVideos } from '/js/video.js';
//   mountVideos(el, { phase: 'first_30', jobTitle: 'Software Engineer', location: 'Leeds' });

/**
 * phases: the phase ids it belongs to. roles / cities: if set, it only shows for matching joiners
 * (roles match the job title as a case-insensitive regex). Role and city matches rank first.
 */
export const VIDEOS = [
  { id: 'lr3ybKC44XQ', title: 'Epic Journey', by: 'Lloyds Bank', length: '1:00', phases: ['offer', 'days_60_90'], blurb: 'The black horse, and the journey you’re starting.' },
  { id: 'HNHhwUyr38g', title: 'Forever Forwards', by: 'Lloyds Bank', length: '', phases: ['offer'], blurb: 'What the bank stands for, in a minute.' },
  { id: 'ZQ17oSp_j7w', title: 'Wellington Place, Leeds', by: 'Lloyds Banking Group', length: '1:03', phases: ['getting_ready', 'first_30'], cities: ['Leeds'], blurb: 'A look round 11 & 12 Wellington Place before your first day.' },
  { id: '2x-2JNBubC0', title: 'Be the voice that helps: Customer Care', by: 'Lloyds Banking Group Careers', length: '', phases: ['getting_ready', 'first_30'], roles: 'customer|advisor|contact', blurb: 'What a day in customer care looks like.' },
  { id: 'PSM-dEue30I', title: 'Emma, Software Engineering, Leeds', by: 'Lloyds Banking Group Careers', length: '', phases: ['first_30', 'days_30_60'], roles: 'engineer|developer|software', blurb: 'An engineer on her team, her work and her first months.' },
  { id: 'Jnnmxc2CWIE', title: 'Holly, Data, Leeds', by: 'Lloyds Banking Group Careers', length: '', phases: ['first_30', 'days_30_60'], roles: 'data|analyst', blurb: 'Working in data at the bank.' },
  { id: '0R4P_ca1xns', title: 'Abhinandan, Technology Engineering, Leeds', by: 'Lloyds Banking Group Careers', length: '', phases: ['days_60_90'], roles: 'engineer|developer|software|data|cyber|analyst', blurb: 'How one colleague has grown his career here.' },
  { id: '5IS6FyUAw0A', title: 'Real questions: Career change', by: 'Lloyds Banking Group Careers', length: '', phases: ['days_30_60', 'days_60_90'], blurb: 'Colleagues on moving roles and changing direction.' },
  { id: '1u9TBXx6ltg', title: 'Drumbeat', by: 'Lloyds Bank', length: '', phases: ['days_60_90'], blurb: 'Full speed ahead.' },
];

const matches = (v, { jobTitle = '', location = '' }) => ({
  role: v.roles ? new RegExp(v.roles, 'i').test(jobTitle) : null,
  city: v.cities ? v.cities.some((c) => c.toLowerCase() === location.toLowerCase()) : null,
});

/** The videos for a phase, most relevant first. Videos aimed at another role or city are left out. */
export function videosFor({ phase, jobTitle, location, limit = 3 }) {
  return VIDEOS
    .filter((v) => v.phases.includes(phase))
    .map((v) => ({ v, m: matches(v, { jobTitle, location }) }))
    .filter(({ m }) => m.role !== false && m.city !== false)
    .sort((a, b) => (b.m.role ? 2 : 0) + (b.m.city ? 1 : 0) - ((a.m.role ? 2 : 0) + (a.m.city ? 1 : 0)))
    .slice(0, limit)
    .map(({ v }) => v);
}

const make = (tag, props = {}, ...children) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...children.filter((c) => c != null && c !== false));
  return n;
};

function ensureStyles() {
  if (document.getElementById('video-css')) return;
  document.head.append(make('style', { id: 'video-css', textContent: `
.vcard { margin: 0; background: var(--lbg-white); border-radius: var(--lbg-radius-lg); box-shadow: var(--lbg-shadow-card); overflow: hidden; }
.vcard-frame { position: relative; aspect-ratio: 16 / 9; background: #0c1a14; }
.vcard-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.vcard-play { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; cursor: pointer; background: #0c1a14; display: block; }
.vcard-play img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: .88; transition: opacity .2s; }
.vcard-play:hover img, .vcard-play:focus-visible img { opacity: 1; }
.vcard-play:focus-visible { outline: 3px solid var(--lbg-focus, #11b67a); outline-offset: -3px; }
.vcard-icon { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%; background: rgba(0,0,0,.72); box-shadow: 0 2px 12px rgba(0,0,0,.35); }
.vcard-icon::after { content: ''; position: absolute; left: 22px; top: 17px; border-style: solid; border-width: 11px 0 11px 18px; border-color: transparent transparent transparent #fff; }
.vcard-len { position: absolute; right: 8px; bottom: 8px; background: rgba(0,0,0,.75); color: #fff; font-size: 12px; padding: 2px 6px; border-radius: 4px; }
.vcard figcaption { padding: var(--lbg-space-3) var(--lbg-space-4) var(--lbg-space-4); }
.vcard figcaption strong { display: block; font-family: var(--lbg-font-strong); }
.vcard figcaption span { display: block; font-size: var(--lbg-text-sm); color: var(--lbg-grey-600); margin-top: 2px; }
.vcard figcaption small { display: block; font-size: 12px; color: var(--lbg-grey-600); margin-top: var(--lbg-space-1); }
.vcards { display: grid; gap: var(--lbg-space-4); }
` }));
}

/** One video card. Nothing loads from YouTube's player until the thumbnail is tapped. */
export function videoCard(v) {
  ensureStyles();
  const thumb = make('img', { src: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, alt: '', loading: 'lazy', decoding: 'async' });
  thumb.addEventListener('error', () => { thumb.hidden = true; }, { once: true });
  const play = make('button', { type: 'button', className: 'vcard-play', ariaLabel: `Play video: ${v.title}${v.length ? `, ${v.length}` : ''}` },
    thumb, make('span', { className: 'vcard-icon' }), v.length ? make('span', { className: 'vcard-len', textContent: v.length }) : null);
  const frame = make('div', { className: 'vcard-frame' }, play);
  play.addEventListener('click', () => {
    const iframe = make('iframe', {
      src: `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
      title: v.title,
      allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
      allowFullscreen: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
    });
    frame.replaceChildren(iframe);
    iframe.focus();
  });
  return make('figure', { className: 'vcard' }, frame,
    make('figcaption', {}, make('strong', { textContent: v.title }), v.blurb ? make('span', { textContent: v.blurb }) : null, make('small', { textContent: v.by })));
}

/** Fills `container` with the cards for this joiner and phase. Returns how many it added. */
export function mountVideos(container, ctx) {
  const list = videosFor(ctx);
  ensureStyles();
  container.classList.add('vcards');
  container.replaceChildren(...list.map(videoCard));
  return list.length;
}
