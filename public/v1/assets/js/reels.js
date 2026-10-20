/* Odometer reels: every digit is a column of 0 to 9 that rolls to its value.
   Screen readers get the plain number from a visually hidden span. */
const digits = '<span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>';

export class Reel {
  constructor(el, { money = el.hasAttribute('data-money') } = {}) {
    this.el = el;
    this.money = money;
    this.value = Number(el.dataset.reel || 0);
    this.str = '';
    this.draw(this.value, false);
  }

  fmt(v) {
    const n = Math.max(0, Math.round(v));
    return this.money ? '$' + n.toLocaleString('en-US') : String(n);
  }

  set(v, animate = true) {
    if (Math.round(v) === Math.round(this.value) && this.str) return;
    this.value = v;
    this.draw(v, animate);
  }

  draw(v, animate) {
    const s = this.fmt(v);
    const prev = this.str;
    this.str = s;
    if (prev.length !== s.length || !this.cols) {
      // rebuild, keeping the old digits right-aligned so the roll still reads
      const oldDigits = prev.replace(/\D/g, '');
      this.el.innerHTML =
        `<span class="sr">${s}</span><span class="reel__cols" aria-hidden="true">` +
        [...s].map(c => (/\d/.test(c)
          ? `<span class="reel__col"><span class="reel__strip">${digits}</span></span>`
          : `<span class="reel__sym">${c}</span>`)).join('') +
        '</span>';
      this.cols = [...this.el.querySelectorAll('.reel__strip')];
      this.sr = this.el.querySelector('.sr');
      const n = this.cols.length;
      this.cols.forEach((strip, i) => {
        const fromRight = n - 1 - i;
        const d = oldDigits[oldDigits.length - 1 - fromRight];
        strip.style.transition = 'none';
        strip.style.transform = `translateY(${-(d === undefined ? 0 : +d)}em)`;
      });
      if (animate) this.el.offsetWidth; // commit the starting positions
      this.cols.forEach(strip => { strip.style.transition = animate ? '' : 'none'; });
    }
    this.sr.textContent = s;
    const ds = s.replace(/\D/g, '');
    this.cols.forEach((strip, i) => {
      strip.style.transitionDelay = animate ? `${(this.cols.length - 1 - i) * 40}ms` : '0ms';
      strip.style.transform = `translateY(${-ds[i]}em)`;
    });
  }
}
