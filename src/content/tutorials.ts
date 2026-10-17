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
  // Precision charges.
  'w4-01': [
    {
      text: {
        tr: 'Komşu bina standart şarjın çemberine giriyor. Sağ alttan HASSAS şarja geç.',
        en: 'The neighbour is inside a standard blast circle. Switch to PRECISION at the bottom right.',
      },
      highlight: { selector: '.kind-toggle' },
      until: 'kind',
    },
    {
      text: {
        tr: 'Hassas şarjın çemberi küçük, savurması az. Kolonların dibine yerleştir.',
        en: 'A precision charge has a small circle and little throw. Place it at the foot of the supports.',
      },
      highlight: { world: { x: 500, y: 450 }, radius: 30 },
      until: 'placed',
    },
    { text: { tr: 'ATEŞLE.', en: 'FIRE.' }, highlight: { selector: '.fire-btn' }, until: 'fired' },
  ],
  // Debris footprint.
  'w4-02': [
    {
      text: {
        tr: "Yerdeki sarı şerit şantiye alanı. Yapının malzemesinin en az %80'i bu alanın içinde kalmalı. Devam etmek için dokun.",
        en: 'The striped strip on the ground is the site. At least 80% of the structure must end up inside it. Tap to continue.',
      },
      highlight: { world: { x: 520, y: 476 }, radius: 120 },
      until: 'tap',
    },
    {
      text: {
        tr: 'Hassas şarjla tek kolonu kes; yapı alanın içine yatsın.',
        en: 'Cut one support with a precision charge so the structure lies down on site.',
      },
      highlight: { selector: '.kind-toggle' },
      until: 'placed',
    },
    { text: { tr: 'ATEŞLE.', en: 'FIRE.' }, highlight: { selector: '.fire-btn' }, until: 'fired' },
  ],
  // The train window.
  'w5-01': [
    {
      text: {
        tr: 'Viyadükteki tren korunuyor ve birkaç saniyede bir geçiyor. Şarjı işaretli alana yerleştir.',
        en: 'The train on the viaduct is protected and passes every few seconds. Place the charge in the marked area.',
      },
      highlight: { world: { x: 280, y: 330 }, radius: 30 },
      until: 'placed',
    },
    {
      text: {
        tr: 'Tren yaklaşınca çember kırmızıya döner. Çember sarıyken ATEŞLE.',
        en: 'The circle turns red as the train approaches. FIRE while it is yellow.',
      },
      highlight: { selector: '.fire-btn' },
      until: 'fired',
    },
  ],
  // The first free-fall bomb and the detonator.
  'w6-01': [
    {
      text: {
        tr: 'Bombalar gökyüzündeki çizgili alana asılır. Bombayı kulenin tam üstüne yerleştir.',
        en: 'Bombs hang in the striped area in the sky. Place the bomb right above the tower.',
      },
      highlight: { world: { x: 460, y: 60 }, radius: 34 },
      until: 'placed',
    },
    {
      text: {
        tr: 'ATEŞLE bombayı bırakır; yer çekimi gerisini yapar.',
        en: 'FIRE releases the bomb; gravity does the rest.',
      },
      highlight: { selector: '.fire-btn' },
      until: 'fired',
    },
    {
      text: {
        tr: 'Bomba kulenin tepesine yaklaşınca PATLAT. Basmazsan fitil 4 saniyede ateşler.',
        en: 'DETONATE as the bomb nears the top of the tower. If you wait, its fuse goes off after 4 seconds.',
      },
      highlight: { selector: '.detonate-btn' },
      until: 'detonated',
    },
  ],
};

export const tutorialIds = (): string[] => Object.keys(TUTORIALS);

/** The coaching steps for a mission, in the given language. */
export const tutorialFor = (levelId: string, language: Language): CoachStep[] | undefined =>
  TUTORIALS[levelId]?.map((step) => ({ ...step, text: step.text[language] }));
