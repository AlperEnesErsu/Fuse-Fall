"""
Generates the campaign missions: src/content/levels/<city>.json.

The JSON files are the shipped data; this script is their source. Change a
mission here, run `npm run levels`, then `npm test`: the level tests check that
every mission stands until fired and is won by its recorded solution.
"""
import json, sys, os
G = 480
CAR_W, CAR_H = 56, 24
FUSE = 0.35


class L:
    def __init__(s, world, n, name, cmax, par, bonus, hint=None):
        s.d = dict(id=f"w{world}-{n:02d}", name=name, world=world, order=n, charges=dict(max=cmax, par=par),
                   bonusCollapse=bonus, zones=[], blocks=[], barrels=[], cars=[], solution=dict(charges=[], fireAt=0))
        if hint: s.d['hint'] = hint

    def b(s, x, y, w, h, m='wood', target=False, anchored=False):
        blk = dict(x=x, y=y, w=w, h=h, material=m)
        if target: blk['target'] = True
        if anchored: blk['anchored'] = True
        s.d['blocks'].append(blk); return y - h / 2

    def col(s, x, base, w, h, m='wood', target=False, anchored=False):
        return s.b(x, base - h / 2, w, h, m, target, anchored)

    def house(s, x, w=70, h=90, m='concrete'):
        blk = dict(x=x, y=G - h / 2, w=w, h=h, material=m, protected=True)
        s.d['blocks'].append(blk)

    def zone(s, x, y, w, h): s.d['zones'].append(dict(x=x, y=y, w=w, h=h))

    def barrel(s, x, base=G): s.d['barrels'].append(dict(x=x, y=base - 16))

    def car(s, x, top, frm, to, speed, target=True, mode=None):
        c = dict(x=x, y=top - CAR_H / 2, w=CAR_W, h=CAR_H, **{'from': frm}, to=to, speed=speed)
        if target: c['target'] = True
        if mode: c['mode'] = mode
        s.d['cars'].append(c); return c

    def sol(s, *pts, fireAt=0, detonateAt=None):
        if detonateAt: s.d['solution']['detonateAt'] = detonateAt
        def charge(p):
            c = dict(x=round(p[0], 1), y=round(p[1], 1))
            if len(p) > 2 and p[2] is not None: c['delay'] = p[2]
            if len(p) > 3: c['kind'] = p[3]
            return c
        s.d['solution']['charges'] = [charge(p) for p in pts]
        s.d['solution']['fireAt'] = fireAt


def car_x(c, t):
    """Ping-pong position after t seconds of cruising, matching LevelSession.cruise."""
    flow = c.get('mode') == 'flow'
    x, d, dt = c['x'], (1 if flow or c['x'] < c['to'] else -1), 1 / 60
    steps = round(t / dt)
    for _ in range(steps):
        x += d * c['speed'] * dt
        if flow:
            if x >= c['to']: x = c['from'] + (x - c['to'])
        elif x >= c['to'] or x <= c['from']:
            x = min(c['to'], max(c['from'], x)); d = -d
    return x


def time_to(c, x_target, start=0.0):
    """First time after `start` that a car reaches x_target (to 1/60 s)."""
    t = start
    while abs(car_x(c, t) - x_target) > c['speed'] / 60 and t < 20: t += 1 / 60
    return round(t * 60) / 60


def tower(l, cx, base, span, colh, m='wood', plank='wood', colw=20, plankh=20, overhang=20):
    l.col(cx - span / 2, base, colw, colh, m)
    l.col(cx + span / 2, base, colw, colh, m)
    return l.col(cx, base - colh, span + colw + overhang, plankh, plank)


def chimney(l, cx, segments, w=44, h=64):
    base = G
    for _ in range(segments): base = l.col(cx, base, w, h, 'concrete')
    l.col(cx, base, 36, 36, 'wood', True)


def road(l, x1, x2, height, pillar='concrete', deck='metal', pw=30, dh=20, anchored=False):
    l.col(x1, G, pw, height, pillar, anchored=anchored)
    l.col(x2, G, pw, height, pillar, anchored=anchored)
    return l.col((x1 + x2) / 2, G - height, x2 - x1 + pw + 20, dh, deck, anchored=anchored)


def ankara():
    out = []
    l = L(1, 1, 'İlk Şarj', 1, 1, 0.6, 'Şarjı taşıyıcı ayakların dibine yerleştir, sonra ateşle.')
    top = tower(l, 600, G, 80, 110); l.col(600, top, 40, 40, 'wood', True)
    l.zone(440, 380, 340, 100); l.sol((600, 470)); out.append(l)

    l = L(1, 2, 'Çift Direk', 2, 1, 0.6, 'Doğru konumdaki tek şarj iki yapıyı birden indirir.')
    for cx in (420, 560):
        top = tower(l, cx, G, 60, 120); l.col(cx, top, 36, 36, 'wood', True)
    l.zone(300, 380, 380, 100); l.sol((490, 470)); out.append(l)

    l = L(1, 3, 'Cam Köşk', 1, 1, 0.7, 'Camın dayanımı düşüktür; uzaktan bir şarj yeterli.')
    top = tower(l, 620, G, 100, 130, 'glass', 'wood'); l.col(620, top, 40, 40, 'wood', True)
    l.zone(420, 400, 130, 80); l.sol((540, 470)); out.append(l)

    l = L(1, 4, 'Yakıt Deposu', 1, 1, 0.6, 'Yakıt varilleri zincirleme patlar. Bunu lehine kullan.')
    top = tower(l, 700, G, 80, 120); l.col(700, top, 40, 40, 'wood', True)
    l.barrel(640); l.zone(420, 400, 160, 80); l.sol((570, 470)); out.append(l)

    l = L(1, 5, 'Betonarme', 3, 2, 0.6, 'Betonarme kolonlar dayanıklıdır. İki kolona ayrı şarj gerekir.')
    top = tower(l, 560, G, 120, 120, 'concrete', 'wood', colw=30); l.col(560, top, 40, 40, 'wood', True)
    l.zone(380, 380, 400, 100); l.sol((500, 470), (620, 470)); out.append(l)

    l = L(1, 6, 'Fabrika Bacası', 2, 1, 0.6, 'Sağdaki bina korunuyor. Baca, tabanı hangi taraftan kesilirse o tarafa devrilir; patlama çemberi binaya değmemeli.')
    base = G
    chimney(l, 520, 5)
    l.house(720, 60, 80)
    l.zone(440, 380, 160, 100); l.sol((500, 470)); out.append(l)

    l = L(1, 7, 'Köprü', 2, 1, 0.6, 'Tabliye ayaklara bağlı; bir ayağı kesersen köprü yana yatar.')
    l.col(400, G, 30, 140, 'concrete'); l.col(680, G, 30, 140, 'concrete')
    top = l.col(540, G - 140, 340, 20, 'wood'); l.col(540, top, 40, 40, 'wood', True)
    l.zone(340, 400, 400, 80); l.sol((386, 436)); out.append(l)

    l = L(1, 8, 'Zincirleme', 1, 1, 0.5, 'İlk varili ateşle; zincir gerisini taşır.')
    top = tower(l, 780, G, 80, 130); l.col(780, top, 40, 40, 'wood', True)
    for x in (470, 585, 700): l.barrel(x)
    l.zone(300, 400, 120, 80); l.sol((360, 436)); out.append(l)

    l = L(1, 9, 'Çelik Kirişler', 3, 2, 0.5, 'Çelik kırılmaz ama devrilir. Ağırlığını kullan.')
    for cx in (450, 650):
        top = tower(l, cx, G, 80, 110, 'wood', 'metal'); l.col(cx, top, 36, 36, 'wood', True)
    l.col(550, G, 60, 60, 'glass')
    l.zone(360, 380, 380, 100); l.sol((450, 470), (650, 470)); out.append(l)

    l = L(1, 10, 'Kızılay Operasyonu', 3, 2, 0.5, 'Üç hedef, bir korunan bina. Sıralamayı iyi planla.')
    top = tower(l, 420, G, 80, 120, 'concrete', 'wood', colw=26); l.col(420, top, 36, 36, 'wood', True)
    top = tower(l, 760, G, 80, 140, 'glass', 'wood'); l.col(760, top, 36, 36, 'wood', True)
    top = tower(l, 590, G, 60, 100); top = tower(l, 590, top, 60, 80); l.col(590, top, 36, 36, 'wood', True)
    l.barrel(680); l.house(150, 80, 100)
    l.zone(300, 380, 360, 100); l.sol((420, 470), (600, 470)); out.append(l)
    return out


def paris():
    out = []
    l = L(2, 1, 'Cam Cephe', 1, 1, 0.6, 'Cam kolonlar kırılgandır; şarjı yakın tutma gereği yok.')
    top = tower(l, 600, G, 90, 130, 'glass', 'wood'); l.col(600, top, 40, 40, 'wood', True)
    l.zone(440, 390, 300, 90); l.sol((560, 470)); out.append(l)

    l = L(2, 2, 'Komşu Duvar', 2, 1, 0.6, 'Soldaki bina korunuyor. Bacayı doğru taraftan kes.')
    chimney(l, 520, 6)
    l.house(330, 60, 80)
    l.zone(440, 380, 160, 100); l.sol((530, 450)); out.append(l)

    l = L(2, 3, 'Cam Teras', 1, 1, 0.6, 'Soldaki dükkân korunuyor. Şarjı ondan uzak tut.')
    top = tower(l, 650, G, 90, 100, 'glass', 'wood'); top = tower(l, 650, top, 70, 90, 'glass', 'wood')
    l.col(650, top, 36, 36, 'wood', True)
    l.house(300, 80, 80)
    l.zone(440, 400, 120, 80); l.sol((535, 468)); out.append(l)

    l = L(2, 4, 'Hareketli Hedef', 1, 1, 0.4, 'Araç şarjın üstünden geçerken ateşle. Zamanlama kritik.')
    deck = road(l, 380, 780, 120)
    c = l.car(420, deck, 410, 750, 90)
    l.zone(540, deck - 40, 80, 38)
    t = 1.5; l.sol((580, deck - 12), fireAt=t)
    assert abs(car_x(c, t) - 580) < 30, car_x(c, t)
    out.append(l)

    l = L(2, 5, 'Ahşap Köprü', 1, 1, 0.6, 'Köprü çökerse araç da düşer.')
    l.col(420, G, 24, 120, 'wood'); l.col(700, G, 24, 120, 'wood')
    deck = l.col(560, G - 120, 320, 16, 'wood')
    l.car(500, deck, 450, 670, 60)
    l.zone(360, 400, 120, 80); l.sol((420, 470)); out.append(l)

    l = L(2, 6, 'Kavşak', 2, 2, 0.4, 'İki araç, iki şarj. Şarjlar sırayla patlar; ikinci gecikmeyi hesaba kat.')
    deckA = road(l, 260, 520, 100)
    cA = l.car(300, deckA, 290, 490, 70)
    deckB = road(l, 600, 880, 170)
    cB = l.car(840, deckB, 630, 850, 100)
    l.zone(330, deckA - 40, 140, 38); l.zone(660, deckB - 40, 160, 38)
    t = 1.2
    xa = car_x(cA, t); xb = car_x(cB, t + FUSE)
    l.sol((xa, deckA - 12), (xb, deckB - 12), fireAt=t); out.append(l)

    l = L(2, 7, 'Konvoy', 3, 2, 0.5, 'Önce aracı yakala, ardından kuleyi indir.')
    deck = road(l, 220, 520, 110)
    c = l.car(260, deck, 250, 490, 80)
    top = tower(l, 720, G, 80, 120); l.col(720, top, 36, 36, 'wood', True)
    l.zone(300, deck - 40, 200, 38); l.zone(600, 400, 240, 80)
    t = 2.5
    l.sol((car_x(c, t), deck - 12), (720, 470), fireAt=t); out.append(l)

    l = L(2, 8, 'Varil Yolu', 1, 1, 0.4, 'Araç varillerin yanına gelince zinciri başlat.')
    deck = road(l, 300, 820, 110)
    c = l.car(340, deck, 330, 790, 110)
    for x in (720, 760): l.barrel(x, deck)
    l.zone(640, deck - 40, 50, 38)
    # Fire as the car nears the barrels; the chain catches it.
    t = 3.4
    l.sol((660, deck - 12), fireAt=t); out.append(l)

    l = L(2, 9, 'Piramit Kaidesi', 3, 1, 0.5, 'Kaideyi kes; piramit kendi ağırlığıyla iner.')
    base = tower(l, 600, G, 180, 90, 'wood', 'wood')
    for w in (200, 150, 100, 60):
        base = l.col(600, base, w, 30, 'glass')
    l.col(600, base, 36, 36, 'wood', True)
    l.zone(420, 400, 100, 80); l.zone(680, 400, 100, 80); l.sol((512, 468)); out.append(l)

    l = L(2, 10, 'Seine Operasyonu', 3, 2, 0.45, 'Trafik, cam ve ahşap. Üç hedefi de indir.')
    deck = road(l, 120, 400, 120)
    c = l.car(160, deck, 150, 370, 80)
    top = tower(l, 560, G, 70, 120, 'glass', 'wood'); l.col(560, top, 36, 36, 'wood', True)
    top = tower(l, 760, G, 80, 120); l.col(760, top, 36, 36, 'wood', True)
    l.barrel(660)
    l.zone(180, deck - 40, 170, 38); l.zone(480, 400, 160, 80)
    t = 1.3
    l.sol((car_x(c, t), deck - 12), (580, 470), fireAt=t); out.append(l)
    return out


def frame(l, xs, base, colh, colw=24, col_m='concrete', deck_m='concrete', deck_h=18, overhang=16):
    """Columns at xs standing on `base`, one deck across them; returns the deck top."""
    for x in xs: l.col(x, base, colw, colh, col_m)
    span = xs[-1] - xs[0] + colw + overhang
    return l.col((xs[0] + xs[-1]) / 2, base - colh, span, deck_h, deck_m)


def q(seconds):
    """Snap to the blasting machine's 50 ms step."""
    return round(round(seconds / 0.05) * 0.05, 3)


# A charge just behind a car throws the wreck forward, clear of the cars that follow.
BEHIND = 18


def london():
    out = []
    # 1. Warm-up: two columns, protected neighbour on the right.
    l = L(3, 1, 'Çift Kolon', 2, 1, 0.5, 'Sağdaki bina korunuyor. Patlama çemberini ondan uzak tut.')
    top = frame(l, [470, 590], G, 120); top = frame(l, [470, 590], top, 100)
    l.col(530, top, 36, 36, 'wood', True)
    l.house(840, 60, 90)
    l.zone(440, 380, 60, 100); l.zone(560, 380, 60, 100)
    l.sol((477, 425)); out.append(l)

    # 2. Three columns; one well-placed charge is enough.
    l = L(3, 2, 'Üç Kolon', 2, 1, 0.5, 'Orta kolon yükün çoğunu taşır.')
    top = frame(l, [420, 520, 620], G, 110); l.col(520, top, 36, 36, 'wood', True)
    l.house(810, 60, 90)
    l.zone(395, 380, 250, 100)
    l.sol((481, 425)); out.append(l)

    # 3. Convoy: the timeline is introduced. Two cars, one spot, two delays.
    l = L(3, 3, 'Konvoy', 2, 2, 0.4, 'İki araç aynı noktadan geçecek. İkinci şarjın gecikmesini ikinci araca göre ayarla.')
    deck = road(l, 60, 560, 110, anchored=True)
    a = l.car(260, deck, 40, 580, 130, mode='flow')
    b = l.car(40, deck, 40, 580, 130, mode='flow')
    l.zone(400, deck - 40, 80, 38)
    t = time_to(a, 420 + BEHIND); d2 = q(time_to(b, 455 + BEHIND, t) - t)
    l.sol((420, deck - 12, 0), (455, deck - 12, d2), fireAt=t); out.append(l)

    # 4. Tower crane: steel cannot break, so cut its legs.
    l = L(3, 4, 'Kule Vinci', 2, 1, 0.5, 'Çelik kırılmaz; vinci devirmek için ahşap ayaklarını kes.')
    l.col(470, G, 24, 140, 'wood'); l.col(570, G, 24, 140, 'wood')
    top = l.col(520, G - 140, 140, 16, 'metal')
    top = l.col(520, top, 20, 120, 'metal')
    l.col(520, top, 36, 36, 'wood', True)
    l.zone(440, 400, 160, 80)
    l.sol((466, 436)); out.append(l)

    # 5. Two lanes, two speeds, one Fire: the delays do the rest.
    l = L(3, 5, 'İki Şerit', 2, 2, 0.4, 'Üst şerit hızlı, alt şerit yavaş. Tek ateşlemeyle iki aracı da yakala.')
    low = road(l, 100, 440, 90, anchored=True)
    high = road(l, 520, 900, 190, anchored=True)
    a = l.car(130, low, 120, 420, 70, mode='flow')
    b = l.car(550, high, 540, 880, 150, mode='flow')
    l.zone(280, low - 40, 80, 38); l.zone(700, high - 40, 80, 38)
    t = time_to(b, 740 + BEHIND); d1 = q(time_to(a, 340 + BEHIND, t) - t)
    l.sol((740, high - 12, 0), (340, low - 12, d1), fireAt=t); out.append(l)

    # 6. Clock tower with a protected neighbour.
    l = L(3, 6, 'Saat Kulesi', 2, 1, 0.6, 'Soldaki bina korunuyor. Kuleyi doğru taraftan kes.')
    chimney(l, 520, 6)
    l.house(280, 60, 80)
    l.zone(440, 380, 160, 100)
    l.sol((530, 470)); out.append(l)

    # 7. Tower bridge: two towers fall on the default sequence; the car needs its own delay.
    l = L(3, 7, 'Kule Köprüsü', 3, 3, 0.45, 'Kuleler ve köprüdeki araç. Kuleleri hemen, aracı geldiğinde vur.')
    for cx in (200, 760):
        top = tower(l, cx, G, 60, 130, 'wood', 'wood', colw=22); l.col(cx, top, 36, 36, 'wood', True)
    deck = road(l, 300, 660, 100, anchored=True)
    c = l.car(330, deck, 320, 640, 160)
    l.zone(140, 400, 120, 80); l.zone(700, 400, 120, 80); l.zone(560, deck - 40, 60, 38)
    d3 = q(time_to(c, 590 + BEHIND))
    l.sol((200, 470, 0), (760, 470, 0.35), (590, deck - 12, d3)); out.append(l)

    # 8. Night convoy: three cars, three delays.
    l = L(3, 8, 'Gece Konvoyu', 3, 3, 0.4, 'Üç araç arka arkaya. Gecikmeleri araç aralıklarına göre ayarla.')
    deck = road(l, 60, 600, 110, anchored=True)
    # Gaps wider than a blast radius plus half a car, so one blast never stalls the next car.
    cars = [l.car(x, deck, 40, 620, 230, mode='flow') for x in (410, 225, 40)]
    l.zone(380, deck - 40, 110, 38)
    t = time_to(cars[0], 400 + BEHIND)
    d2 = q(time_to(cars[1], 432 + BEHIND, t) - t); d3 = q(time_to(cars[2], 464 + BEHIND, t) - t)
    l.sol((400, deck - 12, 0), (432, deck - 12, d2), (464, deck - 12, d3), fireAt=t); out.append(l)

    # 9. The Shard: a tall glass tower between two protected buildings.
    l = L(3, 9, 'Cam Kule', 2, 1, 0.5, 'Cam kırılgandır; şarjı uzaktan kullan.')
    base = G
    for w in (120, 100, 80, 60, 44):
        base = l.col(520, base, w, 60, 'glass')
    l.col(520, base, 30, 30, 'wood', True)
    l.zone(300, 400, 120, 80)
    l.sol((395, 436)); out.append(l)

    # 10. Finale: convoy plus a building, with a protected neighbour.
    l = L(3, 10, 'Londra Finali', 3, 3, 0.4, 'Konvoy ve bina. Üç gecikmeyi tek ateşlemede kur.')
    deck = road(l, 60, 500, 120, anchored=True)
    a = l.car(240, deck, 40, 520, 120, mode='flow')
    b = l.car(40, deck, 40, 520, 120, mode='flow')
    top = frame(l, [780, 880], G, 110, col_m='wood', deck_m='wood'); l.col(830, top, 36, 36, 'wood', True)
    l.zone(340, deck - 40, 90, 38); l.zone(750, 400, 160, 80)
    t = time_to(a, 360 + BEHIND); d2 = q(time_to(b, 395 + BEHIND, t) - t)
    l.sol((360, deck - 12, 0), (395, deck - 12, d2), (790, 440, 0), fireAt=t); out.append(l)
    return out


def rome():
    out = []
    P = 'precision'
    # 1. Precision charge introduced: a neighbour too close for a standard blast.
    l = L(4, 1, 'Hassas Şarj', 2, 1, 0.5, 'Komşu bina çok yakın: standart şarjın çemberi ona değer. Hassas şarja geç.')
    l.d['chargeKinds'] = ['standard', 'precision']
    top = tower(l, 520, G, 70, 120); l.col(520, top, 36, 36, 'wood', True)
    l.house(620, 60, 80)
    l.zone(460, 380, 120, 100)
    l.sol((480, 425, None, P)); out.append(l)

    # 2. Footprint introduced: keep the debris on site.
    l = L(4, 2, 'Dar Şantiye', 3, 1, 0.5, 'Enkaz şeritli alanda kalmalı. Hassas şarj daha az savurur.')
    l.d['chargeKinds'] = ['standard', 'precision']
    top = tower(l, 520, G, 80, 120); top = tower(l, 520, top, 60, 90); l.col(520, top, 36, 36, 'wood', True)
    l.d['footprint'] = dict(**{'from': 400}, to=640, ratio=0.75)
    l.zone(450, 380, 140, 100)
    l.sol((460, 450)); out.append(l)

    # 3. Three-bay arcade.
    l = L(4, 3, 'Kemerli Avlu', 2, 1, 0.5, 'Üç ayaklı yapı. Doğru ayağı kesersen kendi içine çöker.')
    l.d['chargeKinds'] = ['standard', 'precision']
    top = frame(l, [430, 520, 610], G, 110, col_m='wood', deck_m='wood'); l.col(520, top, 36, 36, 'wood', True)
    l.d['footprint'] = dict(**{'from': 380}, to=660, ratio=0.92)
    l.zone(400, 380, 240, 100)
    l.sol((490, 450, None, P)); out.append(l)

    # 4. Marble columns beside a protected ruin.
    l = L(4, 4, 'Mermer Sütunlar', 3, 2, 0.5, 'Soldaki tarihi yapı korunuyor ve şantiye dar.')
    l.d['chargeKinds'] = ['standard', 'precision']
    top = frame(l, [500, 600], G, 140, col_m='concrete', deck_m='wood'); l.col(550, top, 36, 36, 'wood', True)
    l.house(330, 70, 70)
    l.d['footprint'] = dict(**{'from': 440}, to=700, ratio=0.8)
    l.zone(470, 360, 160, 120)
    l.sol((580, 450)); out.append(l)

    # 5. Two buildings, one site.
    l = L(4, 5, 'Pazar Yeri', 3, 2, 0.5, 'İki yapı aynı şantiyede. İkisini de alanın içine indir.')
    l.d['chargeKinds'] = ['standard', 'precision']
    for cx in (440, 600):
        top = tower(l, cx, G, 60, 110); l.col(cx, top, 34, 34, 'wood', True)
    l.d['footprint'] = dict(**{'from': 370}, to=680, ratio=0.88)
    l.zone(390, 380, 270, 100)
    l.sol((400, 450, None, P), (640, 450, None, P)); out.append(l)

    # 6. Bridge over the Tiber: the vehicle must go, the bridge must land on site.
    l = L(4, 6, 'Tiber Köprüsü', 2, 2, 0.5, 'Araç köprüdeyken ayakları kes; köprü şantiyeye düşmeli.')
    l.d['chargeKinds'] = ['standard', 'precision']
    l.col(420, G, 24, 120, 'wood'); l.col(660, G, 24, 120, 'wood')
    deck = l.col(540, G - 120, 290, 16, 'wood')
    l.car(480, deck, 450, 630, 50)
    l.d['footprint'] = dict(**{'from': 360}, to=720, ratio=0.8)
    l.zone(390, 380, 300, 100)
    l.sol((680, 450)); out.append(l)

    # 7. Bell tower: direction and footprint together.
    l = L(4, 7, 'Çan Kulesi', 2, 1, 0.5, 'Şantiye kulenin solunda. Kuleyi o tarafa yatır.')
    l.d['chargeKinds'] = ['standard', 'precision']
    chimney(l, 560, 6)
    l.d['footprint'] = dict(**{'from': 140}, to=620, ratio=0.75)
    l.zone(480, 380, 160, 100)
    l.sol((524, 465)); out.append(l)

    # 8. Long gallery with ancient neighbours on both sides.
    l = L(4, 8, 'Sütunlu Galeri', 3, 2, 0.5, 'Dört ayaklı uzun yapı; iki yanda tarihi yapılar.')
    l.d['chargeKinds'] = ['standard', 'precision']
    top = frame(l, [400, 480, 560, 640], G, 100, col_m='wood', deck_m='wood'); l.col(520, top, 36, 36, 'wood', True)
    l.house(220, 60, 70); l.house(820, 60, 70)
    l.d['footprint'] = dict(**{'from': 340}, to=700, ratio=0.88)
    l.zone(370, 380, 300, 100)
    l.sol((500, 450, None, P), (560, 450, None, P)); out.append(l)

    # 9. Dome: a stepped timber dome on a drum.
    l = L(4, 9, 'Kubbe', 3, 2, 0.5, 'Kasnağı kes; kubbe kendi ağırlığıyla iner.')
    l.d['chargeKinds'] = ['standard', 'precision']
    base = tower(l, 520, G, 140, 100, 'wood', 'wood')
    for w in (150, 110, 70):
        base = l.col(520, base, w, 26, 'wood')
    l.col(520, base, 34, 34, 'wood', True)
    l.house(300, 60, 80); l.house(740, 60, 80)
    l.d['footprint'] = dict(**{'from': 400}, to=640, ratio=0.75)
    l.zone(420, 380, 200, 100)
    l.sol((490, 450, None, P), (550, 450, None, P)); out.append(l)

    # 10. Finale: two buildings, one tight site, ancient neighbour.
    l = L(4, 10, 'Roma Finali', 4, 3, 0.5, 'İki yapı, dar şantiye, yanında tarihi yapı. Her şarjın tipini ve yerini seç.')
    l.d['chargeKinds'] = ['standard', 'precision']
    top = frame(l, [400, 480], G, 120, col_m='wood', deck_m='wood'); l.col(440, top, 34, 34, 'wood', True)
    top = tower(l, 620, G, 60, 100); top = tower(l, 620, top, 50, 80); l.col(620, top, 32, 32, 'wood', True)
    l.house(820, 60, 80)
    l.d['footprint'] = dict(**{'from': 340}, to=700, ratio=0.88)
    l.zone(370, 380, 300, 100)
    l.sol((500, 450, None, P), (560, 450, None, P)); out.append(l)
    return out


# ---- Tokyo: working under a live railway ---------------------------------------
TRAIN = dict(w=220, h=34, speed=260, frm=-300, to=1260)
DECK_TOP = 230


def viaduct(l):
    """Anchored railway viaduct across the whole view; returns the train's centre y."""
    for x in (40, 520, 920):
        l.col(x, G, 30, G - DECK_TOP - 20, 'concrete', anchored=True)
    # Two deck spans that run on past both screen edges, so the train never leaves its viaduct.
    l.col(160, DECK_TOP + 10, 600, 20, 'metal', anchored=True)
    l.col(800, DECK_TOP + 10, 600, 20, 'metal', anchored=True)
    return DECK_TOP - TRAIN['h'] / 2


def train(l, x):
    ty = DECK_TOP
    c = dict(x=x, y=ty - TRAIN['h'] / 2, w=TRAIN['w'], h=TRAIN['h'], **{'from': TRAIN['frm']}, to=TRAIN['to'],
             speed=TRAIN['speed'], mode='flow', style='train')
    c['protected'] = True
    l.d['cars'].append(c)
    return c


def clear_window(c, xs, start=0.0, margin=260):
    """First time from `start` when the train is at least `margin` px from every x in xs, and stays so for 1 s."""
    t = start
    while t < 20:
        ok = all(abs(car_x(c, t + dt / 10) - x) >= margin for x in xs for dt in range(0, 11))
        if ok: return round(t * 60) / 60
        t += 1 / 60
    raise Exception('no window')


def busy_time(c, x):
    """A time when the train is right over x."""
    return time_to(c, x)


def train_safe(c, t, xs, margin):
    return all(abs(car_x(c, t) - x) >= margin for x in xs)


def window_for(c, plan, start=0.0, margin=230):
    """Earliest fire time from `start` at which every charge (x, delay) goes off with the train `margin` px away."""
    t = start
    while t < 20:
        if all(train_safe(c, t + d, [x], margin) for x, d in plan): return round(t * 60) / 60
        t += 1 / 60
    raise Exception('no window')


def tokyo():
    out = []
    P = 'precision'
    S = ['standard', 'precision']

    # 1. The window: a high cut while the train is away.
    l = L(5, 1, 'Sefer Arası', 1, 1, 0.5, 'Tren her birkaç saniyede bir geçer ve korunuyor. Çember kırmızıyken ateşleme.')
    viaduct(l); c = train(l, 700)
    top = tower(l, 300, G, 70, 150); l.col(300, top, 34, 34, 'wood', True)
    l.zone(250, 300, 100, 60)
    t = window_for(c, [(280, 0)]); l.sol((280, 330), fireAt=t); out.append(l)

    # 2. Two stops: both cuts in the same window.
    l = L(5, 2, 'İki Durak', 2, 2, 0.5, 'İki yapı, tek pencere. İki şarj da tren uzaktayken patlamalı.')
    viaduct(l); c = train(l, 200)
    for cx in (240, 720):
        top = tower(l, cx, G, 60, 150); l.col(cx, top, 32, 32, 'wood', True)
    l.zone(190, 300, 100, 60); l.zone(670, 300, 100, 60)
    t = window_for(c, [(220, 0), (700, 0.35)]); l.sol((220, 330), (700, 330), fireAt=t); out.append(l)

    # 3. Precision: a cut right under the deck, out of the train's reach.
    l = L(5, 3, 'Tavan Altı', 2, 1, 0.5, 'Kesim tabliyenin hemen altında. Hassas şarjın çemberi trene ulaşmaz.')
    l.d['chargeKinds'] = S
    viaduct(l); c = train(l, 380)
    top = tower(l, 380, G, 80, 170); l.col(380, top, 30, 30, 'wood', True)
    l.zone(330, 280, 100, 60)
    l.sol((360, 310, None, P), fireAt=0.5); out.append(l)

    # 4. Platform canopy: keep it on site, between trains.
    l = L(5, 4, 'Peron Saçağı', 3, 2, 0.5, 'Saçak enkazı peron alanında kalmalı; tren geçerken ateşleme.')
    l.d['chargeKinds'] = S
    viaduct(l); c = train(l, 900)
    top = frame(l, [160, 260, 360], G, 150, col_m='wood', deck_m='wood'); l.col(260, top, 32, 32, 'wood', True)
    l.d['footprint'] = dict(**{'from': 100}, to=440, ratio=0.75)
    l.zone(130, 300, 260, 60)
    t = window_for(c, [(260, 0)]); l.sol((260, 330), fireAt=t); out.append(l)

    # 5. Signal mast beside a protected kiosk.
    l = L(5, 5, 'Sinyal Direği', 2, 1, 0.5, 'Soldaki büfe korunuyor. Direği sağa yatır; trene dikkat.')
    l.d['chargeKinds'] = S
    viaduct(l); c = train(l, 200)
    chimney(l, 700, 3, w=36, h=60)
    l.house(460, 50, 60)
    l.zone(690, 380, 80, 100)
    t = window_for(c, [(720, 0)]); l.sol((720, 450), fireAt=t); out.append(l)

    # 6. Road under the railway: catch the car, spare the train.
    l = L(5, 6, 'Yol Altı', 1, 1, 0.4, 'Alt yoldaki aracı yakala; üstteki tren korunuyor.')
    viaduct(l)
    road_top = road(l, 120, 480, 90, anchored=True)
    car = l.car(140, road_top, 130, 470, 90)
    c = train(l, 1000)
    l.zone(270, road_top - 40, 80, 38)
    t = time_to(car, 310 + BEHIND)
    l.sol((310, road_top - 12), fireAt=t); out.append(l)

    # 7. Night service: a faster train, a narrower window.
    l = L(5, 7, 'Gece Seferi', 2, 2, 0.5, 'Gece treni daha hızlı. Pencere daha dar.')
    viaduct(l)
    c = train(l, 100); c['speed'] = 380
    for cx in (300, 640):
        top = tower(l, cx, G, 60, 140); l.col(cx, top, 30, 30, 'wood', True)
    l.zone(250, 300, 100, 70); l.zone(590, 300, 100, 70)
    t = window_for(c, [(280, 0), (620, 0.35)], margin=240); l.sol((280, 330), (620, 330), fireAt=t); out.append(l)

    # 8. Depot: barrels under the line, the chain reaches up.
    l = L(5, 8, 'Yakıt Deposu', 1, 1, 0.5, 'Varil zinciri yukarıya doğru da savurur. Treni bekle.')
    viaduct(l); c = train(l, 600)
    top = tower(l, 780, G, 70, 150); l.col(780, top, 32, 32, 'wood', True)
    for x in (650, 710): l.barrel(x)
    l.zone(560, 400, 60, 80)
    t = window_for(c, [(583, 0), (650, 0.12), (710, 0.24)], margin=260); l.sol((583, 468), fireAt=t); out.append(l)

    # 9. Shibuya crossing: traffic below with delays, trains above.
    l = L(5, 9, 'Kavşak Altı', 2, 2, 0.4, 'İki araç alt yolda, tren üstte. Gecikmeleri ikisine göre kur.')
    viaduct(l)
    road_top = road(l, 60, 500, 90, anchored=True)
    a = l.car(260, road_top, 40, 520, 140, mode='flow')
    b = l.car(40, road_top, 40, 520, 140, mode='flow')
    c = train(l, 1100)
    l.zone(300, road_top - 40, 90, 38)
    t = time_to(a, 320 + BEHIND); d2 = q(time_to(b, 355 + BEHIND, t) - t)
    l.sol((320, road_top - 12, 0), (355, road_top - 12, d2), fireAt=t); out.append(l)

    # 10. Finale: a tight site, a protected kiosk, a live line.
    l = L(5, 10, 'Tokyo Finali', 3, 2, 0.45, 'Dar şantiye, korunan büfe ve sefer saati. Hepsini birlikte düşün.')
    l.d['chargeKinds'] = S
    viaduct(l); c = train(l, 300)
    top = frame(l, [620, 720, 820], G, 150, col_m='wood', deck_m='wood'); l.col(720, top, 32, 32, 'wood', True)
    l.house(420, 50, 60)
    l.d['footprint'] = dict(**{'from': 560}, to=900, ratio=0.75)
    l.zone(590, 300, 260, 60)
    t = window_for(c, [(720, 0)]); l.sol((720, 330), fireAt=t); out.append(l)
    return out


def infill(l, frm, to, base, h, course=18):
    """Brick wall laid course by course between two x positions; returns its top."""
    y = base
    while y > base - h + 0.5:
        hh = min(course, y - (base - h))
        l.col((frm + to) / 2, y, to - frm, hh, 'brick')
        y -= hh
    return base - h


def pitched(l, cx, beam_top, widths=(100, 60)):
    """A stepped timber roof over (cx, beam_top): free rafters splay without a tie, so planks step in."""
    top = beam_top
    for i, w in enumerate(widths): top = l.col(cx, top, w, 12, 'wood', i == len(widths) - 1)
    return top


def istanbul():
    out = []
    B = 'bomb'
    SKY = lambda l, x, w: l.d.__setitem__('dropZones', l.d.get('dropZones', []) + [dict(x=x, y=24, w=w, h=70)])

    # 1. First bomb: drop it on the roof and press the detonator.
    l = L(6, 1, 'İlk Bomba', 1, 1, 0.5, 'Bombayı kulenin üstüne as, ATEŞLE ve düşerken PATLAT.')
    l.d['chargeKinds'] = [B]
    top = tower(l, 500, G, 70, 110); top = tower(l, 500, top, 60, 80); l.col(500, top, 34, 34, 'wood', True)
    SKY(l, 420, 160); l.zone(0, 0, 1, 1)
    l.sol((460, 60, 0, B), detonateAt=[0.6]); out.append(l)

    # 2. Airburst: the mast top must go, the houses below must not.
    l = L(6, 2, 'Havada Patlat', 1, 1, 0.5, 'Aşağıdaki evler korunuyor. Bombayı direğin tepesindeyken patlat, yere inmeden.')
    l.d['chargeKinds'] = [B]
    chimney(l, 500, 5, w=40, h=60)
    l.house(360, 60, 70); l.house(640, 60, 70)
    SKY(l, 440, 120); l.zone(0, 0, 1, 1)
    l.sol((520, 60, 0, B), detonateAt=[0.7]); out.append(l)

    # 3. Roof: the bomb lands on a brick house; keep the debris on site.
    l = L(6, 3, 'Çatı Katı', 2, 1, 0.5, 'Bombayı mahyaya indir ve hemen patlat. Fitile kalırsa çatıdan kayar.')
    l.d['chargeKinds'] = ['standard', B]
    # The tie beam is the target; the rafters above it send a late bomb rolling towards the neighbour.
    top = infill(l, 420, 580, G, 72); top = l.col(500, top, 180, 14, 'wood')
    pitched(l, 500, top)
    l.house(690, 50, 60)
    SKY(l, 440, 120); l.zone(420, 380, 160, 100)
    l.sol((500, 60, 0, B), detonateAt=[1.2]); out.append(l)

    # 4. Two bombs, one press.
    l = L(6, 4, 'İki Bomba', 2, 2, 0.5, 'İki bomba, tek PATLAT. Aradaki ev korunuyor: bombalar yere inmeden, ikisi de hedefine vardığında bas.')
    l.d['chargeKinds'] = [B]
    for cx in (300, 680):
        top = tower(l, cx, G, 60, 120); l.col(cx, top, 32, 32, 'wood', True)
    SKY(l, 240, 120); SKY(l, 620, 120); l.zone(0, 0, 1, 1)
    # The neighbour between the towers rules out leaving the bombs to their fuses.
    l.house(490, 50, 60)
    l.sol((280, 60, 0, B), (660, 60, 0.35, B), detonateAt=[1.5]); out.append(l)

    # 5. Charge and bomb: cut the base, then catch the top.
    l = L(6, 5, 'Fitil ve Bomba', 2, 2, 0.5, 'Fitil tabanı keser; bomba üst katı yakalar. Sağdaki ev korunuyor: bombayı havada patlat.')
    l.d['chargeKinds'] = ['standard', B]
    top = tower(l, 520, G, 70, 120, 'concrete', 'wood', colw=26); top = tower(l, 520, top, 60, 90); l.col(520, top, 32, 32, 'wood', True)
    SKY(l, 440, 160); l.zone(450, 380, 140, 100)
    l.house(780, 50, 60)
    l.sol((470, 440), (520, 60, 0.35, B), detonateAt=[1.1]); out.append(l)

    # 6. Galata Tower: a tall stone tower beside a protected neighbour.
    l = L(6, 6, 'Galata Kulesi', 2, 1, 0.5, 'Taş kule uzun ve sağlam. Bombayı tepesine indir; komşu korunuyor.')
    l.d['chargeKinds'] = ['standard', B]
    t = G
    for i in range(6): t = l.col(520, t, 56, 52, 'brick' if i > 0 else 'concrete')
    l.col(520, t, 32, 32, 'wood', True)
    l.house(380, 60, 70)
    SKY(l, 460, 120); l.zone(470, 380, 120, 100)
    l.sol((520, 60, 0, B), detonateAt=[1.0]); out.append(l)

    # 7. Bosphorus Bridge: catch the car with a falling bomb.
    l = L(6, 7, 'Boğaz Köprüsü', 1, 1, 0.4, 'Araç köprüde gidip geliyor. Bombayı yola düşür, araç yanına gelince PATLAT.')
    l.d['chargeKinds'] = [B]
    deck = road(l, 300, 700, 140, anchored=True)
    l.car(340, deck, 330, 670, 80)
    SKY(l, 420, 160); l.zone(0, 0, 1, 1)
    l.sol((460, 60, 0, B), detonateAt=[1.0]); out.append(l)

    # 8. Han courtyard: two wings, a protected fountain house between them.
    l = L(6, 8, 'Han Avlusu', 2, 2, 0.5, 'İki kanat, ortada korunan çeşme, solda korunan bekçi kulübesi. İki bombayı da kanatların üstünde patlat.')
    l.d['chargeKinds'] = [B]
    for cx in (330, 690):
        top = infill(l, cx - 70, cx + 70, G, 72); top = l.col(cx, top, 160, 14, 'wood')
        pitched(l, cx, top)
    l.house(510, 60, 60)
    SKY(l, 270, 120); SKY(l, 630, 120); l.zone(0, 0, 1, 1)
    l.house(180, 50, 60)
    l.sol((325, 60, 0, B), (695, 60, 0.35, B), detonateAt=[1.4]); out.append(l)

    # 9. Ferry pier: drop the bomb into the barrels; the chain does the rest.
    l = L(6, 9, 'Feribot İskelesi', 1, 1, 0.5, 'Bombayı varillerin yanına indir. Zincir kuleyi yıkar.')
    l.d['chargeKinds'] = [B]
    top = tower(l, 760, G, 70, 140); l.col(760, top, 32, 32, 'wood', True)
    for x in (560, 630, 690): l.barrel(x)
    SKY(l, 500, 120); l.zone(0, 0, 1, 1)
    l.sol((520, 60, 0, B), detonateAt=[0.9]); out.append(l)

    # 10. Finale: an apartment block and a chimney, a protected neighbour.
    l = L(6, 10, 'İstanbul Finali', 3, 2, 0.45, 'Apartman ve baca birlikte iner. Fitil orta kolona, bomba bacanın tepesine.')
    l.d['chargeKinds'] = ['standard', B]
    base = G
    xs = [220, 300, 380]
    for floor in range(2):
        for k in range(2): infill(l, xs[k] + 12, xs[k + 1] - 12, base, 72)
        base = frame(l, xs, base, 72, col_m='wood', deck_m='wood')
    l.col(300, base, 32, 32, 'wood', True)
    # The chimney has room to fall towards the apartment; the neighbour stands well clear.
    chimney(l, 620, 5, w=40, h=56)
    l.house(860, 50, 60)
    SKY(l, 560, 120); l.zone(190, 380, 220, 100)
    l.sol((300, 440), (620, 60, 0, B), detonateAt=[1.0]); out.append(l)
    return out


def crane(l, hook_x, top, length, angle, radius=24):
    """A crane: a fixed mast and jib, and a wrecking ball hanging from the hook,
    pulled back by `angle` (radians from straight down; negative = to the left).
    The mast stands behind the pulled-back ball, clear of its swing."""
    import math
    side = -1 if angle < 0 else 1
    mast_x = round(hook_x + side * (length * abs(math.sin(angle)) + radius + 30))
    assert 12 <= mast_x <= 948, f'crane mast at {mast_x} is off the world: shorten the rope or the angle'
    l.col(mast_x, G, 24, G - top, 'metal', anchored=True)
    x0, x1 = sorted((mast_x, hook_x))
    l.b((x0 + x1) / 2, top - 8, (x1 - x0) + 40, 16, 'metal', anchored=True)
    hook = dict(x=hook_x, y=top + 8)
    l.d.setdefault('balls', []).append(dict(hook=hook, length=length, angle=angle, radius=radius))
    return hook


def hook_zone(l, hook):
    """Where a rope-cutting charge goes: right at the crane hook."""
    l.zone(hook['x'] - 24, hook['y'] - 6, 48, 40)


def berlin():
    out = []
    P = 'precision'

    # 1. First swing: Fire lets the crane go; the ball does the rest.
    l = L(7, 1, 'İlk Gülle', 1, 1, 0.5, 'ATEŞLE vincin frenini bırakır. Gülle salınır ve kuleye çarpar.')
    crane(l, 300, 120, 240, -1.1)
    top = tower(l, 470, G, 70, 110); top = tower(l, 470, top, 60, 90); l.col(470, top, 34, 34, 'wood', True)
    l.zone(420, 430, 100, 50)
    l.sol(); out.append(l)

    # 2. Cut loose: the kiosk under the swing is protected; the tower is out of reach unless the ball flies.
    l = L(7, 2, 'Kesik Halat', 1, 1, 0.5, 'Kulübe korunuyor, kule erişilmez. Halatı doğru anda kes: gülle uçsun.')
    hook = crane(l, 300, 120, 240, -1.1)
    l.house(420, 50, 50)
    top = tower(l, 585, G, 70, 120); l.col(585, top, 34, 34, 'wood', True)
    hook_zone(l, hook)
    l.sol((300, hook['y'] + 10, 1.15)); out.append(l)

    # 3. The Wall: a brick wall right at the bottom of the swing; the ball goes straight through.
    l = L(7, 3, 'Duvar', 1, 1, 0.6, 'Tuğla duvar salınımın en alt noktasında. Gülle tam ortadan geçer.')
    crane(l, 280, 140, 230, -1.0)
    top = infill(l, 330, 400, G, 108); l.col(365, top, 34, 34, 'wood', True)
    l.zone(310, 430, 110, 50)
    l.sol(); out.append(l)

    # 4. Two cranes: one tower, a ball from each side.
    l = L(7, 4, 'İki Vinç', 1, 1, 0.5, 'İki gülle iki yandan. Ortadaki kule dayanamaz.')
    crane(l, 270, 120, 230, -1.0)
    crane(l, 690, 120, 230, 1.0)
    top = tower(l, 480, G, 80, 120); top = tower(l, 480, top, 70, 90); l.col(480, top, 34, 34, 'wood', True)
    l.zone(430, 430, 100, 50)
    l.sol(); out.append(l)

    # 5. Ball and fuse: concrete is too strong for the ball alone; a charge cracks it first.
    l = L(7, 5, 'Gülle ve Fitil', 2, 1, 0.5, 'Beton kolonlar gülleye dayanır. Önce bir şarjla çatlat.')
    crane(l, 290, 130, 240, -1.0)
    base = G
    xs = [430, 510]
    base = frame(l, xs, base, 100)
    l.col(470, base, 34, 34, 'wood', True)
    l.zone(400, 420, 140, 60)
    l.sol((430, 450)); out.append(l)

    # 6. Chimney: struck high from the left, it falls right; the neighbour sits safely under the swing.
    l = L(7, 6, 'Baca', 1, 1, 0.5, 'Bacaya yüksekten vur. Soldaki ev korunuyor; gülle üstünden geçer.')
    crane(l, 330, 80, 190, -1.2)
    chimney(l, 480, 5, w=40, h=56)
    l.house(210, 60, 70)
    l.zone(440, 440, 80, 40)
    l.sol(); out.append(l)

    # 7. Over the top: a protected block stands between the crane and the target.
    l = L(7, 7, 'Üstünden', 1, 1, 0.5, 'Aradaki bina korunuyor. Gülleyi yükselirken bırak, üstünden aşsın.')
    hook = crane(l, 300, 110, 230, -1.2)
    l.house(480, 60, 110)
    top = tower(l, 615, G, 70, 100); l.col(615, top, 34, 34, 'wood', True)
    hook_zone(l, hook)
    l.sol((300, hook['y'] + 10, 1.2)); out.append(l)

    # 8. Chain: barrels on a stand at the height of the swing; their blasts take the depot down.
    l = L(7, 8, 'Zincir', 1, 1, 0.5, 'Gülle sehpadaki varillere çarpar; patlamalar depoyu yıkar.')
    crane(l, 300, 140, 230, -1.0)
    stand = l.col(360, G, 60, 95, 'wood')
    for x in (346, 374):
        l.d['barrels'].append(dict(x=x, y=stand - 16))
    top = tower(l, 450, G, 80, 120, plank='metal'); l.col(450, top, 34, 34, 'wood', True)
    l.zone(410, 430, 80, 50)
    l.sol(); out.append(l)

    # 9. Flying start: cut the rope so the ball lands on the barrels; their blasts reach the tower.
    l = L(7, 9, 'Uçan Gülle', 1, 1, 0.5, 'Gülleyi varillerin üstüne uçur. Zincir kuleyi yıkar; kulübe korunuyor.')
    hook = crane(l, 300, 120, 240, -1.1)
    l.house(420, 50, 50)
    stand = l.col(585, G, 60, 60, 'wood')
    for x in (571, 599):
        l.d['barrels'].append(dict(x=x, y=stand - 16))
    top = tower(l, 700, G, 70, 130); l.col(700, top, 34, 34, 'wood', True)
    hook_zone(l, hook)
    l.sol((300, hook['y'] + 10, 1.15)); out.append(l)

    # 10. Finale: a timber frame with brick infill; one charge leans it, two and the ball bring it down.
    l = L(7, 10, 'Berlin Finali', 3, 2, 0.45, 'Gülle, iki şarj ve korunan komşu. Hepsini birlikte düşün.')
    l.d['chargeKinds'] = ['standard', P]
    hook = crane(l, 290, 120, 240, -1.0)
    base = G
    xs = [420, 500, 580]
    for floor in range(2):
        for k in range(2): infill(l, xs[k] + 12, xs[k + 1] - 12, base, 72)
        base = frame(l, xs, base, 72, col_m='wood', deck_m='wood')
    l.col(500, base, 32, 32, 'wood', True)
    l.house(800, 60, 80)
    l.zone(400, 420, 200, 60)
    hook_zone(l, hook)
    l.sol((420, 450), (580, 450, 0.3)); out.append(l)
    return out

def scale_zones(l, levels_total=70):
    """Charge zones follow the difficulty curve: roomy on the first jobs, tight on the
    last. Every solution charge stays inside its zone (with a margin), small special
    zones (crane hooks) keep their size, and zones never go below the ground."""
    d = ((l.d['world'] - 1) * 10 + (l.d['order'] - 1)) / (levels_total - 1)
    f = 1.35 - 0.6 * d
    points = [(c['x'], c['y']) for c in l.d['solution']['charges']]
    for z in l.d['zones']:
        if z['w'] < 80 or z['h'] < 30:
            continue
        inside = [(x, y) for x, y in points if z['x'] <= x <= z['x'] + z['w'] and z['y'] <= y <= z['y'] + z['h']]
        cx, cy = z['x'] + z['w'] / 2, z['y'] + z['h'] / 2
        w, h = z['w'] * f, z['h'] * f
        x0, x1, y0, y1 = cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2
        for x, y in inside:
            x0, x1, y0, y1 = min(x0, x - 14), max(x1, x + 14), min(y0, y - 14), max(y1, y + 14)
        x0, x1, y0, y1 = max(0, x0), min(960, x1), max(0, y0), min(G, y1)
        z.update(x=round(x0), y=round(y0), w=round(x1 - x0), h=round(y1 - y0))


outdir = sys.argv[1]
for name, levels in (('ankara', ankara()), ('paris', paris()), ('london', london()), ('rome', rome()), ('tokyo', tokyo()), ('istanbul', istanbul()), ('berlin', berlin())):
    for l in levels:
        # Footprint jobs offer the implosion charge: it folds a structure onto its own site.
        if 'footprint' in l.d and 'implosion' not in l.d.get('chargeKinds', ['standard']):
            l.d['chargeKinds'] = l.d.get('chargeKinds', ['standard']) + ['implosion']
        scale_zones(l)
    json.dump([l.d for l in levels], open(os.path.join(outdir, f'{name}.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
print('ok')
