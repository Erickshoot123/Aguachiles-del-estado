export class PrintActivity {
  busy = 0;
  paused = false;
  prepare(): boolean {
    if (this.busy) return false;
    this.paused = true;
    return true;
  }
}
