export const CATEGORIES = {
  characters: {
    id: 'characters',
    label: 'Characters',
    color: '#ff7a90',
    emoji: '◇',
  },
  systems: {
    id: 'systems',
    label: 'Game Systems',
    color: '#5ce1e6',
    emoji: '◈',
  },
  places: {
    id: 'places',
    label: 'Places & Levels',
    color: '#6ee7b7',
    emoji: '⬡',
  },
  story: {
    id: 'story',
    label: 'Story Beats',
    color: '#f6c177',
    emoji: '✦',
  },
  decisions: {
    id: 'decisions',
    label: 'Decisions',
    color: '#c4a1ff',
    emoji: '✤',
  },
  questions: {
    id: 'questions',
    label: 'Open Questions',
    color: '#ff9f43',
    emoji: '?',
  },
  tapestry: {
    id: 'tapestry',
    label: 'Tapestry',
    color: '#f472b6',
    emoji: '✧',
  },
};

export function categoryOf(id) {
  return CATEGORIES[id] || CATEGORIES.tapestry;
}
