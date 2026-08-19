import type { Category, ScheduleData } from '../types';
import { ALL_DAYS } from '../types';
import { makeId } from '../lib/id';

function item(
  title: string,
  emoji: string,
  time: string,
  notes: string,
  subSteps: string[],
  days: number[] = ALL_DAYS,
): Category['items'][number] {
  return {
    id: makeId(),
    title,
    emoji,
    time,
    notes,
    done: false,
    days,
    subSteps: subSteps.map((text) => ({ id: makeId(), text, done: false })),
  };
}

export function buildDefaultSchedule(): ScheduleData {
  const categories: Category[] = [
    {
      id: makeId(),
      name: 'Morning Routine',
      emoji: '☀️',
      color: 'orange',
      items: [
        item('Make Your Bed', '🛏️', '7:00 AM', 'Pull the covers all the way up and straighten the pillow.', [
          'Straighten the sheet',
          'Pull up the comforter',
          'Fluff and place the pillow',
        ]),
        item('Brush Teeth', '🪥', '7:05 AM', 'Two full minutes — set a timer if it helps.', [
          'Wet the toothbrush',
          'Brush for 2 minutes',
          'Rinse and put toothbrush away',
        ]),
        item('Get Dressed', '👕', '7:10 AM', 'Check the weather so you pick the right layers.', [
          'Check the weather',
          'Put on clean clothes',
          'Put on socks',
        ]),
        item('Eat Breakfast', '🥣', '7:20 AM', '', ['Eat something', 'Drink a glass of water', 'Rinse your bowl']),
        item('Pack School Bag', '🎒', '7:35 AM', 'Match it against your class schedule for the day.', [
          'Homework in the folder',
          'Chromebook/charger packed',
          'Water bottle filled',
        ]),
      ],
    },
    {
      id: makeId(),
      name: 'Chores',
      emoji: '🧹',
      color: 'green',
      items: [
        item('Clean Your Room', '🧸', '', 'Work top to bottom: surfaces, floor, then trash.', [
          'Put dirty clothes in the hamper',
          'Put toys and books away',
          'Clear off the desk',
          'Vacuum or sweep the floor',
        ]),
        item('Feed the Dog', '🐕', '', 'Fresh water every time, not just food.', [
          'Fill food bowl',
          'Fill water bowl',
          'Wash hands after',
        ]),
        item('Take Out Trash', '🗑️', '', '', ['Tie off the bag', 'Bring to the outside bin', 'Put in a new bag']),
        item('Unload Dishwasher', '🍽️', '', 'Ask if you\'re not sure where something goes.', [
          'Put away dishes',
          'Put away silverware',
          'Leave dishwasher door closed',
        ]),
      ],
    },
    {
      id: makeId(),
      name: 'Soccer Prep',
      emoji: '⚽',
      color: 'blue',
      items: [
        item(
          'Pack Soccer Bag',
          '🎽',
          '',
          'Lay everything out before you pack it so nothing gets left behind.',
          ['Cleats', 'Shin guards', 'Practice jersey', 'Water bottle filled'],
          [1, 2, 3], // Mon/Tue/Wed practice days
        ),
        item(
          'Warm-Up Drills',
          '🔥',
          '',
          "Do these before practice or a game — don't skip the stretch.",
          ['10 jumping jacks', 'Dribble figure-8 x5', '20 juggles', 'Stretch legs for 2 minutes'],
          [1, 2, 3],
        ),
        item('Ball Control Practice', '🥅', '', '15 minutes in the yard or driveway.', [
          'Inside-foot passes x20',
          'Cone weave x5',
          'Juggling — beat your best count',
        ]),
      ],
    },
  ];

  return {
    childName: '',
    categories,
    lastResetDate: '',
  };
}
