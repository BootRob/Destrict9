// What each of the 5 journey phases shows on /joiner/phase.html: what to do now, its guides and its videos.
// Phase ids, names and horse lines match the shared /api/journey `phase` contract (see MORNING-PLAN).

export const PHASES = [
  {
    id: 'offer', n: 1, name: 'Offer', line: 'Saddling up',
    intro: 'Your conditional offer and security checks. Your recruiter is your contact for everything at this stage.',
    todo: [
      { title: 'Accept your conditional offer', text: 'Read it through, then accept it in the app. Ask your recruiter if anything is unclear.', href: '/joiner/offer.html' },
      { title: 'Send your screening details', text: 'About 15 minutes: ID, right to work, and the last 3 years of work history.', href: '/joiner/screening.html' },
      { title: 'Let the checks run', text: 'They usually take 2 to 4 weeks. No news is normal; we’ll tell you as soon as they’re done.' },
    ],
    guides: ['01-your-journey', '02-pre-employment-checks', '10-when-plans-change', '11-who-to-ask'],
  },
  {
    id: 'getting_ready', n: 2, name: 'Getting ready', line: 'Joining the stable',
    intro: 'Your unconditional offer is accepted. Meet your manager, choose your kit and get ready for Day 1.',
    todo: [
      { title: 'Say hello to your manager', text: 'Your chat with them is open. Ask them anything about the team or your role.', href: '/joiner/chat.html?kind=manager' },
      { title: 'Choose your laptop', text: 'Pick it at least a week before your start date so it’s ready on Day 1.', href: '/joiner/device.html' },
      { title: 'Check your Day 1 details', text: 'Your start time, where to meet, who meets you and the dress code.', href: '/joiner/guides.html' },
      { title: 'Do the pre-start onboarding training', text: 'About 40 minutes. Finish it before Day 1 and lunch with your team is on us.' },
    ],
    guides: ['03-first-day-and-week', '14-getting-to-the-office', '06-laptop-and-it', '04-pay-and-benefits', '12-our-purpose', '13-our-values'],
  },
  {
    id: 'first_30', n: 3, name: 'First 30 days', line: 'Finding your stride',
    intro: 'What to do, where to find things, and the training to finish in your first month.',
    todo: [
      { title: 'Week 1: get set up and meet people', text: 'Log in, set up Teams and Outlook, and meet your team.' },
      { title: 'Start your mandatory training', text: 'Seven modules, about 6 hours in work time, all due within 30 days.', guide: '17-mandatory-training' },
      { title: 'Learn the systems and the jargon', text: 'Where things live, and what the acronyms mean.', guide: '16-systems-and-ways-of-working' },
      { title: 'Prepare for your 30-day check-in', text: 'How the month went, training done, and your first objectives.' },
    ],
    guides: ['15-first-30-days', '16-systems-and-ways-of-working', '17-mandatory-training', '05-hybrid-working', '08-wellbeing-and-support', '09-code-of-conduct'],
  },
  {
    id: 'days_30_60', n: 4, name: '30 to 60 days', line: 'Setting your course', preview: true,
    intro: 'Setting targets: clear goals with your manager, and a development plan to go with them.',
    todo: [
      { title: 'Agree your objectives', text: 'Three clear goals, agreed at your 30-day check-in.', guide: '18-goals-and-development-plan' },
      { title: 'Write your development plan', text: 'The skills you want to build this year, and how you’ll build them.' },
      { title: 'Ask for feedback early', text: 'A quick “what should I do more or less of?” every couple of weeks.' },
      { title: 'Get ready for your 3-month check-in', text: 'Part of your 6-month probation.' },
    ],
    guides: ['18-goals-and-development-plan', '07-learning-and-training'],
  },
  {
    id: 'days_60_90', n: 5, name: '60 to 90 days and beyond', line: 'Full horsepower', preview: true,
    intro: 'You know your way around. Now grow your Lloyds career.',
    todo: [
      { title: 'Have a career conversation', text: 'Talk to your manager about where you’d like to be in a year or two.', guide: '19-growing-your-career' },
      { title: 'Find a mentor and a network', text: 'Colleague networks and mentoring are open to everyone.' },
      { title: 'Pass your 6-month review', text: 'The end of probation, and a look back at your first objectives.' },
    ],
    guides: ['19-growing-your-career', '08-wellbeing-and-support'],
  },
];

export const phaseById = (id) => PHASES.find((p) => p.id === id);

/** The joiner's current phase id: from the API's `phase` if present, otherwise worked out from the journey. */
export function currentPhaseId(journey, today = new Date().toISOString().slice(0, 10)) {
  if (journey?.phase?.id && phaseById(journey.phase.id)) return journey.phase.id;
  const stage = journey?.offer?.stage ?? journey?.stage ?? journey?.applicant?.journeyStage;
  const start = journey?.offer?.startDate ?? journey?.startDate;
  if (stage && stage !== 'accepted') return 'offer';
  if (!start || today < start) return 'getting_ready';
  const days = (Date.parse(today) - Date.parse(start)) / 86_400_000;
  return days < 30 ? 'first_30' : days < 60 ? 'days_30_60' : 'days_60_90';
}
