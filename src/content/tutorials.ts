import type { CoachStep } from '../presentation/coach';
import type { Language } from '../presentation/strings';

type TutorialStep = Omit<CoachStep, 'text'> & { readonly text: Readonly<Record<Language, string>> };

/**
 * Coaching for the missions that introduce something new. Shown until the
 * mission is cleared once. World coordinates match the level data.
 */
const TUTORIALS: Readonly<Record<string, readonly TutorialStep[]>> = {
  // First mission: placing and firing.
  'w1-01': [
    {
      text: {
        tr: 'Sarı şeritli alan şarj bölgesi. Kolonların dibine dokunarak bir şarj yerleştir.',
        en: 'The striped area is the charge zone. Tap at the foot of the columns to place a charge.',
      },
      highlight: { world: { x: 600, y: 452 }, radius: 34 },
      until: 'placed',
    },
    {
      text: {
        tr: 'Kesikli çember patlamanın etki alanıdır. Hazırsan fünyeye bas: ATEŞLE.',
        en: 'The dashed circle is the blast radius. When ready, hit the detonator: FIRE.',
      },
      highlight: { selector: '.fire-btn' },
      until: 'fired',
    },
  ],
  // First protected building.
  'w1-06': [
    {
      text: {
        tr: 'Turkuaz köşeli bina korunuyor. Hasar görürse sözleşme iptal olur. Devam etmek için dokun.',
        en: 'The building with teal corners is protected. Damage it and the contract is void. Tap to continue.',
      },
      highlight: { world: { x: 720, y: 440 }, radius: 56 },
      until: 'tap',
    },
    {
      text: {
        tr: 'Baca, tabanı hangi taraftan kesilirse o tarafa devrilir. Şarjı sol tarafa koy; çember binaya değmesin.',
        en: 'A chimney falls toward the side its base is cut. Put the charge on the left; keep the circle off the building.',
      },
      highlight: { world: { x: 500, y: 452 }, radius: 30 },
      until: 'placed',
    },
    {
      text: { tr: 'Çember binaya değmiyorsa güvendesin. ATEŞLE.', en: 'If the circle stays clear of the building, you are safe. FIRE.' },
      highlight: { selector: '.fire-btn' },
      until: 'fired',
    },
  ],
  // First moving vehicle.
  'w2-04': [
    {
      text: {
        tr: 'Araç köprüde gidip geliyor. Şarjı yolun üstündeki işaretli alana yerleştir.',
        en: 'The vehicle drives back and forth on the bridge. Place the charge in the marked area on the road.',
      },
      highlight: { world: { x: 580, y: 328 }, radius: 30 },
      until: 'placed',
    },
    {
      text: {
        tr: 'Araç şarjın üstüne geldiği anda ATEŞLE. Zamanlama her şeydir.',
        en: 'FIRE the moment the vehicle reaches the charge. Timing is everything.',
      },
      highlight: { selector: '.fire-btn' },
      until: 'fired',
    },
  ],
  // First mission that needs the delay timeline.
  'w3-03': [
    {
      text: {
        tr: 'İki araç arka arkaya geçecek. Yol üzerindeki alana iki şarj yerleştir.',
        en: 'Two vehicles will pass one after the other. Place two charges in the zone on the road.',
      },
      highlight: { world: { x: 440, y: 328 }, radius: 40 },
      until: 'placed',
      count: 2,
    },
    {
      text: {
        tr: 'Gecikme çizelgesinde 2 numaralı şarjı sağa sürükle: ikinci araç geldiğinde patlasın (yaklaşık 1700–2000 ms).',
        en: 'On the delay timeline, drag charge 2 to the right so it goes off when the second vehicle arrives (about 1700–2000 ms).',
      },
      highlight: { selector: '.timeline' },
      until: 'delay',
    },
    {
      text: {
        tr: 'İlk araç şarjların hemen önüne geldiğinde ATEŞLE.',
        en: 'FIRE when the first vehicle is just in front of the charges.',
      },
      highlight: { selector: '.fire-btn' },
      until: 'fired',
    },
  ],
};

export const tutorialIds = (): string[] => Object.keys(TUTORIALS);

/** The coaching steps for a mission, in the given language. */
export const tutorialFor = (levelId: string, language: Language): CoachStep[] | undefined =>
  TUTORIALS[levelId]?.map((step) => ({ ...step, text: step.text[language] }));
