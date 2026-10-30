/**
 * Angre/gjør om som lagrer kun det rektangelet som endret seg (før/etter).
 * v1 lagret hele lerretet som base64-PNG 20 ganger (treg, minnetung, flimret).
 */
export interface Patch {
  x: number;
  y: number;
  before: ImageData;
  after: ImageData;
}

export class History {
  private stack: Patch[] = [];
  private index = 0; // antall «aktive» steg
  private bytes = 0;

  constructor(
    private budgetBytes = 160 * 1024 * 1024,
    private maxSteps = 60,
  ) {}

  push(p: Patch) {
    // Kast «redo»-grenen
    for (let i = this.index; i < this.stack.length; i++) this.bytes -= this.size(this.stack[i]);
    this.stack.length = this.index;
    this.stack.push(p);
    this.bytes += this.size(p);
    this.index++;
    while ((this.bytes > this.budgetBytes || this.stack.length > this.maxSteps) && this.stack.length > 1) {
      this.bytes -= this.size(this.stack.shift()!);
      this.index--;
    }
  }

  undo(): Patch | null {
    if (this.index === 0) return null;
    return this.stack[--this.index];
  }

  redo(): Patch | null {
    if (this.index >= this.stack.length) return null;
    return this.stack[this.index++];
  }

  get canUndo() {
    return this.index > 0;
  }
  get canRedo() {
    return this.index < this.stack.length;
  }

  clear() {
    this.stack = [];
    this.index = 0;
    this.bytes = 0;
  }

  private size(p: Patch) {
    return p.before.data.byteLength + p.after.data.byteLength;
  }
}
