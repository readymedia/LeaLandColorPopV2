'use client';

/**
 * Skriver ut ett bilde, tilpasset arket. v1 skrev ut hele appen via window.print() og
 * skjulte deler med CSS, noe som ga forskjøvne og avkuttede utskrifter.
 */
export function printImage(src: string) {
  document.querySelectorAll('.ll-print-sheet').forEach((n) => n.remove());
  const sheet = document.createElement('div');
  sheet.className = 'll-print-sheet';
  const img = document.createElement('img');
  img.alt = '';
  sheet.appendChild(img);
  document.body.appendChild(sheet);
  const cleanup = () => {
    sheet.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  img.onload = () => setTimeout(() => window.print(), 50);
  img.src = src;
}
