import type { CoachStep } from '../presentation/coach';

/**
 * Coaching for the missions that introduce something new. Shown until the
 * mission is cleared once. World coordinates match the level data.
 */
export const TUTORIALS: Readonly<Record<string, readonly CoachStep[]>> = {
  // First mission: placing and firing.
  'w1-01': [
    {
      text: 'Sarı şeritli alan şarj bölgesi. Kolonların dibine dokunarak bir şarj yerleştir.',
      highlight: { world: { x: 600, y: 452 }, radius: 34 },
      until: 'placed',
    },
    {
      text: 'Kesikli çember patlamanın etki alanıdır. Hazırsan fünyeye bas: ATEŞLE.',
      highlight: { selector: '.fire-btn' },
      until: 'fired',
    },
  ],
  // First protected building.
  'w1-06': [
    {
      text: 'Turkuaz köşeli bina korunuyor. Hasar görürse sözleşme iptal olur. Devam etmek için dokun.',
      highlight: { world: { x: 720, y: 440 }, radius: 56 },
      until: 'tap',
    },
    {
      text: 'Baca, tabanı hangi taraftan kesilirse o tarafa devrilir. Şarjı sol tarafa koy; çember binaya değmesin.',
      highlight: { world: { x: 500, y: 452 }, radius: 30 },
      until: 'placed',
    },
    { text: 'Çember beyaz/sarı kaldıysa güvendesin. ATEŞLE.', highlight: { selector: '.fire-btn' }, until: 'fired' },
  ],
  // First moving vehicle.
  'w2-04': [
    {
      text: 'Araç köprüde gidip geliyor. Şarjı yolun üstündeki işaretli alana yerleştir.',
      highlight: { world: { x: 580, y: 328 }, radius: 30 },
      until: 'placed',
    },
    {
      text: 'Araç şarjın üstüne geldiği anda ATEŞLE. Zamanlama her şeydir.',
      highlight: { selector: '.fire-btn' },
      until: 'fired',
    },
  ],
  // First mission that needs the delay timeline.
  'w3-03': [
    {
      text: 'İki araç arka arkaya geçecek. Yol üzerindeki alana iki şarj yerleştir.',
      highlight: { world: { x: 440, y: 328 }, radius: 40 },
      until: 'placed',
      count: 2,
    },
    {
      text: 'Gecikme çizelgesinde 2 numaralı şarjı sağa sürükle: ikinci araç geldiğinde patlasın (yaklaşık 1700–2000 ms).',
      highlight: { selector: '.timeline' },
      until: 'delay',
    },
    {
      text: 'İlk araç şarjların hemen önüne geldiğinde ATEŞLE.',
      highlight: { selector: '.fire-btn' },
      until: 'fired',
    },
  ],
};
