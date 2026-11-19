import { T } from './strings';

/**
 * A new release is ready: a small bar with a reload button, never a reload on its own,
 * so a job in progress is not lost. Bare DOM, like the crash screen.
 */
export const showUpdateNotice = (root: HTMLElement, reload: () => void): void => {
  if (root.querySelector('.update-notice')) return;
  const S = T.update;
  const text = document.createElement('span');
  text.textContent = S.ready;
  const now = document.createElement('button');
  now.className = 'btn small primary';
  now.textContent = S.reload;
  now.addEventListener('click', reload);
  const later = document.createElement('button');
  later.className = 'btn small';
  later.textContent = S.later;
  const bar = document.createElement('div');
  bar.className = 'update-notice';
  bar.setAttribute('role', 'status');
  bar.append(text, now, later);
  later.addEventListener('click', () => bar.remove());
  root.append(bar);
};
