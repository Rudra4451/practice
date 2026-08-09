/**
 * TyProX The One-Key Experience Listener (Revision 2 & Anti-Pattern Rule 2)
 * Instant startup focus entry (< 2ms) without modal popups or clicks.
 */

export type OneKeyCallback = () => void;

export class OneKeyListener {
  private static activeCallback: OneKeyCallback | null = null;
  private static isListening = false;

  public static activate(callback: OneKeyCallback): void {
    this.activeCallback = callback;
    if (!this.isListening && typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown, { capture: true });
      this.isListening = true;
    }
  }

  public static deactivate(): void {
    this.activeCallback = null;
    if (this.isListening && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown, { capture: true });
      this.isListening = false;
    }
  }

  private static handleKeyDown = (e: KeyboardEvent): void => {
    // Ignore input if user is already typing inside an input or textarea
    const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (targetTag === 'input' || targetTag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
      return;
    }

    // Trigger on Enter, Space, or printable character keypress
    if (
      e.key === 'Enter' ||
      e.key === ' ' ||
      (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)
    ) {
      if (this.activeCallback) {
        this.activeCallback();
      }
    }
  };
}
