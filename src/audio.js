// Все звуки генерируются через Web Audio API — аудиофайлы не нужны.
// tone() создаёт тон, а noise() — короткий шум для ударов и разрушений.
export class GameAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
  }

  // Браузеры разрешают создать/возобновить звук после действия пользователя,
  // поэтому init() вызывается при нажатии кнопки старта.
  init() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    // master — общая громкость, через которую проходят все звуки игры.
    this.master = this.context.createGain();
    this.master.gain.value = .22;
    this.master.connect(this.context.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : .22, this.context.currentTime, .03);
  }

  // Осциллятор создаёт звуковую волну заданной частоты.
  // Громкость плавно уменьшается почти до нуля, чтобы не было резкого щелчка.
  tone(frequency, duration, type = 'sine', volume = .15, slide = 0) {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  // Шум — это массив случайных значений. Фильтр убирает высокие частоты,
  // а множитель (1 - i / length) постепенно затихает к концу звука.
  noise(duration = .12, volume = .15, cutoff = 1200) {
    if (!this.context || this.muted) return;
    const length = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  // Готовые сочетания звуков для игровых событий.
  hit() { this.noise(.08, .18, 900); this.tone(160, .08, 'triangle', .12, -70); }
  swipe() { this.noise(.07, .06, 2500); }
  crash(big = false) {
    this.noise(big ? .38 : .22, big ? .5 : .32, big ? 650 : 1500);
    this.tone(big ? 70 : 120, big ? .35 : .18, 'square', .12, -35);
    setTimeout(() => this.noise(.12, .1, 2400), 45);
  }
  jump() { this.tone(280, .12, 'sine', .08, 160); }
  start() { this.tone(330, .12, 'triangle', .1, 110); setTimeout(() => this.tone(520, .18, 'triangle', .1, 130), 110); }
  end() { this.tone(330, .2, 'triangle', .1, -80); setTimeout(() => this.tone(220, .45, 'triangle', .1, -80), 170); }
}
