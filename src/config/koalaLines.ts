/**
 * What Koa says, by context. Voice (character bible §1): short, warm, encouraging, never
 * preachy. Koa never nags, guilts or talks during focus.
 *
 * Each line has a stable id so the brain can avoid repeating itself.
 */

export type LineTopic =
  | 'greetMorning'
  | 'greetAfternoon'
  | 'greetEvening'
  | 'greetNight'
  | 'idle'
  | 'shopHint'
  | 'tap'
  | 'tickle'
  | 'surprised'
  | 'wake'
  | 'breakStart'
  | 'longBreakStart'
  | 'breakOver'
  | 'celebrate'
  | 'cycle'
  | 'dailyGoal'
  | 'showOff'

export const koalaLines: Record<LineTopic, readonly string[]> = {
  greetMorning: ['Good morning!', 'Morning! Ready when you are.', 'A fresh day. Let’s ease in.'],
  greetAfternoon: ['Hi again!', 'Good afternoon!', 'Oh, hi! I saved you a seat.'],
  greetEvening: ['Good evening!', 'Evening! Let’s take it slow.', 'Hi! Cozy study time?'],
  greetNight: ['Studying late? I’m here.', 'Hi, night owl.', 'Just a little bit, then rest?'],
  idle: [
    'One more page?',
    'Ready when you are.',
    'I could go for some eucalyptus.',
    'Shall we start a focus session?',
    'It’s nice and quiet here.',
    'We got this!',
  ],
  shopHint: ['Can we get a new hat?', 'You have coins to spend!', 'Ooh, the shop looks fun.'],
  tap: ['Hi!', 'Hehe.', 'That’s me!', 'Hello there.', 'Boop.'],
  tickle: ['Hehe, that tickles!', 'Eep, tickly!'],
  surprised: ['Whoa!', 'Oh! You startled me.'],
  wake: ['Mm… I was just resting my eyes.', 'Oh! You’re back.', '*yawn* Hi again.'],
  breakStart: ['Time for a little break.', 'Stretch with me?', 'Sip some water!', 'Rest your eyes for a bit.'],
  longBreakStart: ['You earned a long break.', 'Long break! Go stretch your legs.', 'Snack time, maybe?'],
  breakOver: ['Break’s over. Ready when you are.', 'Feeling rested?', 'Back to it, whenever you like.'],
  celebrate: ['You did it!', 'I’m proud of you!', 'Nice focus!', 'That was a good one.'],
  cycle: ['A whole cycle! I’m so proud of you.', 'Four in a row! Amazing.'],
  dailyGoal: ['We hit today’s goal!', 'Daily goal done. You’re a star.'],
  showOff: ['Ooh, thank you!', 'I love it!', 'So cozy!'],
}
