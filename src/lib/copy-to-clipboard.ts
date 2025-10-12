import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';

export async function copyToClipboard(text: string): Promise<void> {
  // Use Capacitor clipboard on native
  if (Capacitor.isNativePlatform()) {
    try {
      await Clipboard.write({
        string: text,
      });
      return;
    } catch (e) {
      console.warn('Capacitor clipboard failed, falling back.', e);
      // Fallback to web APIs if native fails for some reason
    }
  }

  // Use modern web API
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (e) {
      console.warn('navigator.clipboard.writeText failed, falling back.', e);
      // Fallback to execCommand
    }
  }

  // Fallback for older browsers
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed'; // Prevent scrolling to bottom of page in MS Edge.
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const successful = document.execCommand('copy');
    if (!successful) {
        throw new Error('Fallback copy failed');
    }
    document.body.removeChild(textarea);
    return;
  } catch (e) {
    console.error('All copy methods failed', e);
    throw new Error('Failed to copy to clipboard.');
  }
}
