import type { LevelDefinition } from '../core/level';
import type { Language } from '../presentation/strings';

/**
 * One short card for each thing a job can bring in, shown the first time a
 * player meets it (and again from the HUD's "?"). Two lines at most: what it
 * is and the one trick that makes it work.
 */
export const FEATURE_IDS = [
  'protected',
  'timeline',
  'barrels',
  'vehicles',
  'precision',
  'implosion',
  'trains',
  'bombs',
  'balls',
  'trams',
  'roller',
  'directional',
  'loadout',
] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

type Text = Readonly<Record<Language, string>>;

export interface FeatureCard {
  readonly id: FeatureId;
  readonly title: Text;
  readonly text: Text;
  /** The trick: the one thing that makes this work, in a line. */
  readonly tip: Text;
}

const CARDS: Readonly<Record<FeatureId, Omit<FeatureCard, 'id'>>> = {
  protected: {
    title: { tr: 'Korunan bina', en: 'Protected building' },
    text: { tr: 'Turkuaz köşeli binalar korunuyor. Hasar alırlarsa sözleşme iptal olur.', en: 'Buildings with teal corners are protected. Damage one and the contract is void.' },
    tip: { tr: 'Şarjın dolu çemberi binaya değmesin; yıkılan yapı da üstüne düşmesin.', en: 'Keep the solid circle off them, and make sure the collapse falls away from them.' },
  },
  timeline: {
    title: { tr: 'Gecikme çizelgesi', en: 'Delay timeline' },
    text: { tr: 'Birden çok şarj sırayla patlar. Alttaki çizelgede her şarjın gecikmesini kaydır.', en: 'Several charges go off in turn. Slide each one along the timeline at the bottom.' },
    tip: { tr: 'Önce taşıyan kolonu kes, sonra devrilmesini istediğin tarafı: yapı o yöne yatar.', en: 'Cut the load-bearing side first, then the side you want it to fall toward.' },
  },
  barrels: {
    title: { tr: 'Patlayıcı varil', en: 'Explosive barrel' },
    text: { tr: 'Kırmızı variller bir patlama ya da sert çarpma ile kendileri de patlar.', en: 'Red barrels go off too when a blast or a hard hit reaches them.' },
    tip: { tr: 'Bir varili tetikle, zincir gerisini halletsin: daha az şarj, daha çok yıldız.', en: 'Set off one barrel and let the chain do the rest: fewer charges, more stars.' },
  },
  vehicles: {
    title: { tr: 'Hareketli araç', en: 'Moving vehicle' },
    text: { tr: 'Araçlar yolda gidip gelir. ATEŞLE\'ye bastığın an, patlama anını belirler.', en: 'Vehicles drive back and forth. When you press FIRE decides when it blows.' },
    tip: { tr: 'Bir tur izle, aracın şarjın üstünden geçtiği anı yakala; gecikme çizelgesiyle ince ayar yap.', en: 'Watch one lap, catch the moment it passes the charge, fine-tune with the timeline.' },
  },
  precision: {
    title: { tr: 'Hassas şarj', en: 'Precision charge' },
    text: { tr: 'Küçük çaplı, az savuran şarj. Korunan yapının dibinde bile güvenle kesebilir.', en: 'A small, low-throw charge. It can cut right next to protected property.' },
    tip: { tr: 'HUD\'dan şarj türünü seç; dar alanda hassas, açık alanda standart kullan.', en: 'Pick the kind in the HUD: precision in tight spots, standard in the open.' },
  },
  implosion: {
    title: { tr: 'İçe çöken şarj', en: 'Implosion charge' },
    text: { tr: 'Patlatmaz, çeker: yapıyı merkeze ve aşağı toplar, kendi alanına çöker.', en: 'It pulls instead of pushing: the structure folds in and down onto its own footprint.' },
    tip: { tr: 'Yapının ortasına, yerden biraz yukarı koy. Etrafında korunan bina varken idealdir.', en: 'Set it in the middle, a little off the ground. Ideal with protected neighbours.' },
  },
  trains: {
    title: { tr: 'Tren seferi', en: 'Train schedule' },
    text: { tr: 'Tren raydan çıkmaz ve durmaz. Üstteyken patlatmak sözleşmeyi bozar.', en: 'The train keeps to its rails and never stops. Blowing up while it is on the bridge voids the job.' },
    tip: { tr: 'Tren geçip gittikten hemen sonra ATEŞLE; sıradaki sefere kadar zamanın var.', en: 'FIRE right after it has passed; you have until the next run.' },
  },
  bombs: {
    title: { tr: 'Serbest düşüşlü bomba', en: 'Free-fall bomb' },
    text: { tr: 'Gökyüzündeki alana asılır, ATEŞLE ile düşer. PATLAT düğmesiyle istediğin an patlatırsın.', en: 'Hung in the sky zone, it drops on FIRE. DETONATE sets it off whenever you choose.' },
    tip: { tr: 'Havada patlatmak çatıyı ezer; yere değince patlatmak temeli keser.', en: 'Mid-air it crushes the roof; on the ground it cuts the base.' },
  },
  balls: {
    title: { tr: 'Yıkım güllesi', en: 'Wrecking ball' },
    text: { tr: 'ATEŞLE vincin frenini bırakır, gülle salınıp çarpar. Kancadaki şarj halatı keser.', en: 'FIRE lets the crane go and the ball swings in. A charge at the hook cuts the rope.' },
    tip: { tr: 'Halatı salınımın en hızlı anında kes: gülle fırlayıp uzağa uçar.', en: 'Cut the rope at the fastest point of the swing and the ball flies far.' },
  },
  trams: {
    title: { tr: 'Tramvay', en: 'Tram' },
    text: { tr: 'Tramvay rayında gider, itilmez. Korunan tramvaya patlama değmemeli.', en: 'The tram runs on its rails and cannot be pushed. A protected tram must stay clear of blasts.' },
    tip: { tr: 'Tramvayın geçişini bekle, sonra ATEŞLE; gecikmeyle arkasından yetiş.', en: 'Wait for it to pass, then FIRE; use the delay to follow behind it.' },
  },
  roller: {
    title: { tr: 'Yürüyen şarj', en: 'Rolling charge' },
    text: { tr: 'Yere konan küçük araba. Ateşlenince okun yönüne sürer, bir şeye çarpınca patlar.', en: 'A little cart on the ground. Fired, it drives the way its arrow points and goes off when it hits something.' },
    tip: { tr: 'Şarja dokun, yönünü çevir. Sarı alanın erişemediği yere bununla ulaşırsın.', en: 'Tap the charge to turn it round. It reaches what the zone cannot.' },
  },
  directional: {
    title: { tr: 'Yönlü şarj', en: 'Directional charge' },
    text: {
      tr: 'Patlamanın gücü yalnızca okun gösterdiği yarım düzleme gider. Arkasındaki yapılar hafif sarsılır.',
      en: 'Its blast throws only into the half-plane its arrow points to. Structures behind it barely move.',
    },
    tip: {
      tr: 'Korunan bina arkadaysa ok ondan uzağa baksın; şarja dokunup yönünü çevir.',
      en: 'If a protected building is behind, aim the arrow away from it; tap the charge to turn it.',
    },
  },
  loadout: {
    title: { tr: 'Envanter', en: 'Loadout' },
    text: { tr: 'Bu işte her şarj türünden belli sayıda var. Düğmelerdeki sayılar kalanı gösterir.', en: 'This job hands out a set number of each kind. The counts on the buttons show what is left.' },
    tip: { tr: 'Hepsini kullanmak zorunda değilsin: doğru şarjı doğru yere seçmek yeter.', en: 'You need not use them all: picking the right one for each spot is the puzzle.' },
  },
};

export const featureCard = (id: FeatureId): FeatureCard => ({ id, ...CARDS[id] });

/** What a job brings in, read from its data, in the order the cards are shown. */
export const featuresOf = (level: LevelDefinition): FeatureId[] => {
  const has: Record<FeatureId, boolean> = {
    protected: level.blocks.some((b) => b.protected),
    timeline: level.charges.max >= 2 && level.solution.charges.some((c) => c.delay !== undefined),
    barrels: level.barrels.length > 0,
    vehicles: level.cars.some((c) => c.style !== 'train' && c.style !== 'tram'),
    precision: level.chargeKinds.includes('precision'),
    implosion: level.chargeKinds.includes('implosion'),
    trains: level.cars.some((c) => c.style === 'train'),
    bombs: level.chargeKinds.includes('bomb'),
    balls: level.balls.length > 0,
    trams: level.cars.some((c) => c.style === 'tram'),
    roller: level.chargeKinds.includes('roller'),
    directional: level.chargeKinds.includes('directional'),
    loadout: level.charges.stock !== undefined,
  };
  return FEATURE_IDS.filter((id) => has[id]);
};

/** Cards to show before a job: what it brings in that the player has not seen yet. */
export const newFeatures = (level: LevelDefinition, seen: readonly string[]): FeatureId[] =>
  featuresOf(level).filter((id) => !seen.includes(id));
