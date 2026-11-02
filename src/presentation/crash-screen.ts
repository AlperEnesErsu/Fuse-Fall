import { T } from './strings';

/**
 * The way out when the game cannot go on: a plain panel over everything with a
 * restart button. Built with bare DOM so it works even when the game never started.
 */
export const showCrashScreen = (root: HTMLElement, restart: () => void): void => {
  const S = T.crash;
  const title = document.createElement('h2');
  title.textContent = S.title;
  const body = document.createElement('p');
  body.className = 'meta';
  body.textContent = S.body;
  const button = document.createElement('button');
  button.className = 'btn primary';
  button.textContent = S.restart;
  button.addEventListener('click', restart);
  const panel = document.createElement('div');
  panel.className = 'panel crash';
  panel.setAttribute('role', 'alertdialog');
  panel.setAttribute('aria-label', S.title);
  panel.append(title, body, button);
  const screen = document.createElement('div');
  screen.className = 'screen crash';
  screen.append(panel);
  root.append(screen);
  button.focus();
};
