import { describe, expect, it, vi } from 'vitest';
import { Progression } from '../src/app/progression';
import { ScreenFlow, type ScreenDeps } from '../src/app/screen-flow';
import { DEFAULT_BLAST_STYLE, earnScrap, emptyProgress, levelsOf, type Progress } from '../src/core/progress';
import { loadCampaign } from '../src/content/levels';
import { contentText } from '../src/content/text';
import type { MenuState } from '../src/presentation/ui';

/** The value, or a failed test when it is missing. */
const must = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('missing test fixture');
  return value;
};

const campaign = loadCampaign();
const flush = () => new Promise((r) => setTimeout(r, 0));

/** Screens over fake presentation: every call is recorded, progress lives in memory. */
const setup = (start: Progress = emptyProgress()) => {
  let progress = start;
  const ledger = { get: () => progress, set: vi.fn((p: Progress) => ((progress = p), true)) };
  const ui = {
    menu: vi.fn(),
    achievements: vi.fn(),
    workshop: vi.fn(),
    isShowing: vi.fn(() => false),
    freeSite: vi.fn(),
    cityMap: vi.fn(),
    levelSelect: vi.fn(),
    settings: vi.fn(),
    codeEntry: vi.fn(),
    toast: vi.fn(),
  };
  const play = { leave: vi.fn(), play: vi.fn(), startLevel: vi.fn() };
  const deps: ScreenDeps = {
    campaign,
    ledger,
    access: new Progression(campaign, () => progress, false),
    text: () => contentText('en'),
    ui,
    renderer: { setScene: vi.fn() },
    sound: { denied: vi.fn(), test: vi.fn() },
    desk: { load: vi.fn(() => Promise.resolve({ ad: undefined, packs: [], demo: false })), watchAd: vi.fn(), buy: vi.fn() },
    offers: { privacyChoicesRequired: () => false, showPrivacyChoices: vi.fn() },
    play,
    settingsChanged: vi.fn(),
    now: () => new Date(2026, 9, 18, 12),
  };
  return { screens: new ScreenFlow(deps), deps, ui, play, ledger, progress: () => progress };
};

describe('screen flow', () => {
  it('leaves the job for the menu, whose Continue starts the next mission', () => {
    const { screens, ui, play } = setup();
    screens.menu();
    expect(play.leave).toHaveBeenCalled();
    const state = must(ui.menu.mock.calls[0])[0] as MenuState;
    state.onContinue();
    expect(play.startLevel).toHaveBeenCalledWith(must(levelsOf(campaign, 1)[0]).id);
  });

  it('refuses a workshop item the player cannot afford', () => {
    const { screens, ui, deps, ledger } = setup();
    screens.workshop();
    must(ui.workshop.mock.calls[0])[1].onBuy('thermite');
    expect(deps.sound.denied).toHaveBeenCalled();
    expect(ui.toast).toHaveBeenCalled();
    expect(ledger.set).not.toHaveBeenCalled();
  });

  it('buys a blast style, puts it straight into use and shows the workshop again', () => {
    const { screens, ui, progress } = setup(earnScrap(emptyProgress(), 1000));
    screens.workshop();
    must(ui.workshop.mock.calls[0])[1].onBuy('thermite');
    expect(progress().workshop.owned).toContain('thermite');
    expect(progress().workshop.blastStyle).toBe('thermite');
    expect(ui.workshop).toHaveBeenCalledTimes(2);
  });

  it('shows store offers once they load, while the workshop is still open', async () => {
    const { screens, ui } = setup();
    ui.isShowing.mockReturnValue(true);
    screens.workshop();
    await flush();
    expect(ui.workshop).toHaveBeenCalledTimes(2);
    expect(must(ui.workshop.mock.calls[1])[2]).toEqual({ ad: undefined, packs: [], demo: false });
  });

  it('starts a Free Site job in the chosen way to play', () => {
    const { screens, ui, play } = setup();
    screens.freeSite(1, 'timber-tower', 'one-shot', true);
    must(ui.freeSite.mock.calls[0])[6]();
    expect(play.play).toHaveBeenCalledWith(expect.objectContaining({ world: 1 }), {
      kind: 'sandbox',
      template: 'timber-tower',
      variant: 'one-shot',
      traffic: true,
    });
  });

  it('remembers the city play entered, and falls back to the map for an unknown city', () => {
    const { screens, ui, deps } = setup();
    screens.enterWorld(1);
    screens.levels();
    expect(deps.renderer.setScene).toHaveBeenCalledWith(must(campaign.worlds[0]).key, 0.3);
    expect(ui.levelSelect).toHaveBeenCalled();
    screens.levels(999);
    expect(ui.cityMap).toHaveBeenCalled();
  });

  it('saves a settings change and redraws the screen when the language changes', () => {
    const { screens, ui, deps, progress } = setup();
    screens.settings();
    const onChange = must(ui.settings.mock.calls[0])[1];
    onChange({ haptics: false });
    expect(progress().settings.haptics).toBe(false);
    expect(deps.settingsChanged).toHaveBeenCalledWith({ haptics: false });
    expect(ui.settings).toHaveBeenCalledTimes(1);
    onChange({ language: 'en' });
    expect(ui.settings).toHaveBeenCalledTimes(2);
  });
  it('wires every screen button to the screen or job it names', async () => {
    const { screens, ui, play, deps } = setup(earnScrap(emptyProgress(), 1000));
    ui.isShowing.mockReturnValue(true);
    vi.mocked(deps.desk.watchAd).mockResolvedValue(true);
    vi.mocked(deps.desk.buy).mockResolvedValue(true);
    screens.menu();
    const menu = must(ui.menu.mock.calls[0])[0] as MenuState;
    menu.onPlay();
    expect(ui.cityMap).toHaveBeenCalledTimes(1);
    menu.onDaily();
    expect(play.play).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: 'daily', day: '2026-10-18' }));
    menu.onFreeSite();
    expect(ui.freeSite).toHaveBeenCalledTimes(1);
    menu.onAchievements();
    must(ui.achievements.mock.calls[0])[1]();
    menu.onSettings();
    const [, , onTest, onBack] = must(ui.settings.mock.calls[0]);
    onTest();
    expect(deps.sound.test).toHaveBeenCalled();
    onBack();
    expect(ui.menu).toHaveBeenCalledTimes(3);

    must(ui.cityMap.mock.calls[0])[2](1);
    expect(ui.levelSelect).toHaveBeenCalledTimes(1);
    const levels = must(ui.levelSelect.mock.calls[0]);
    levels[5]('w1-01');
    expect(play.startLevel).toHaveBeenCalledWith('w1-01');
    levels[6]();
    expect(ui.cityMap).toHaveBeenCalledTimes(2);
    must(ui.cityMap.mock.calls[0])[3]();
    expect(ui.menu).toHaveBeenCalledTimes(4);

    const site = must(ui.freeSite.mock.calls[0]);
    site[5]({ world: 1, template: 'apartment', variant: 'smash', traffic: false });
    expect(must(ui.freeSite.mock.calls[1])[3]).toEqual({ world: 1, template: 'apartment', variant: 'smash', traffic: false });
    site[7]();
    expect(ui.menu).toHaveBeenCalledTimes(5);

    menu.onWorkshop();
    const shop = () => must(ui.workshop.mock.calls[ui.workshop.mock.calls.length - 1])[1];
    shop().onBuy('theme:cardboard');
    expect(deps.ledger.get().workshop.blockTheme).toBe('theme:cardboard');
    shop().onEquip(DEFAULT_BLAST_STYLE);
    expect(deps.ledger.get().workshop.blastStyle).toBe(DEFAULT_BLAST_STYLE);
    shop().onEquip('theme:cardboard');
    shop().onWatchAd();
    shop().onBuyPack('scrap_small');
    await flush();
    expect(deps.desk.watchAd).toHaveBeenCalled();
    expect(deps.desk.buy).toHaveBeenCalledWith('scrap_small');
    shop().onBack();
    expect(ui.menu).toHaveBeenCalledTimes(6);
  });
});
