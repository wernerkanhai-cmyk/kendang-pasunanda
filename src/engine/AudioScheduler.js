export class AudioScheduler {
  constructor(onTick, onPrecount, onScheduleAudio) {
    this.audioCtx = null;
    this.bpm = 100;
    this.isPlaying = false;
    this.isRecording = false;

    // Callbacks
    this.onTick = onTick;                     // (slotIndex) → visual cursor update
    this.onPrecount = onPrecount;             // (countDown) → void
    this.onScheduleAudio = onScheduleAudio;   // (slotIndex, audioTime) → play samples
    
    // Timing state
    this.currentSlot = 0;
    this.nextNoteTime = 0.0;
    
    // Lookahead (ms) before timer wakes up
    this.lookahead = 25.0;
    // Schedule ahead time (s) to put events in queue
    this.scheduleAheadTime = 0.1;
    
    this.timerID = null;
    this.totalSlots = 192;
    this.loopStart = 0; // Slot waarnaar terug geloopt wordt
  }

  setAudioContext(ctx) {
    this.audioCtx = ctx;
  }

  init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  getSecondsPerSlot() {
    // 60 seconds / BPM = time per quarter note beat
    // 1 beat = 12 slots
    return (60.0 / this.bpm) / 12.0;
  }

  nextNote() {
    const secondsPerSlot = this.getSecondsPerSlot();
    this.nextNoteTime += secondsPerSlot;
    
    this.currentSlot++;
    if (this.currentSlot >= this.totalSlots) {
      this.currentSlot = this.loopStart; // Loop terug naar startpunt
    }
  }

  setTotalSlots(n) {
    this.totalSlots = Math.max(1, n);
    if (this.currentSlot >= this.totalSlots) this.currentSlot = 0;
  }

  // Audio-clock time waarop slot loopStart speelt — voor rAF cursor
  playStartAudioTime = 0;

  getCurrentGlobalSlot() {
    if (!this.isPlaying || !this.audioCtx) return this.loopStart;
    const secondsPerSlot = this.getSecondsPerSlot();
    const elapsed = this.audioCtx.currentTime - this.playStartAudioTime;
    if (elapsed < 0) return this.loopStart;
    const loopLength = this.totalSlots - this.loopStart;
    const totalSlots = Math.floor(elapsed / secondsPerSlot);
    return this.loopStart + (totalSlots % loopLength);
  }

  scheduleNote(slotNumber, time) {
    // Metronoomklik tijdens opname
    if (this.isRecording && slotNumber % 12 === 0) {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.frequency.value = (slotNumber % 48 === 0) ? 880 : 440;
      gain.gain.setValueAtTime(0.1, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      osc.start(time);
      osc.stop(time + 0.05);
    }

    // Samples schedulen op exact audio-tijdstip
    if (this.onScheduleAudio && !this.isRecording) {
      this.onScheduleAudio(slotNumber, time);
    }

  }

  scheduler = () => {
    if (!this._logged) {
      this._logged = true;
      const latency = (this.audioCtx.outputLatency || 0) + (this.audioCtx.baseLatency || 0);
      console.log('[AudioScheduler] EERSTE RUN',
        'currentTime=', this.audioCtx.currentTime.toFixed(3),
        'nextNoteTime=', this.nextNoteTime.toFixed(3),
        'diff (ms)=', ((this.nextNoteTime - this.audioCtx.currentTime) * 1000).toFixed(1),
        'outputLatency=', (this.audioCtx.outputLatency || 0).toFixed(4),
        'baseLatency=', (this.audioCtx.baseLatency || 0).toFixed(4),
        'totalLatency (ms)=', (latency * 1000).toFixed(1)
      );
    }
    while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentSlot, this.nextNoteTime);
      this.nextNote();
    }
    this.timerID = setTimeout(this.scheduler, this.lookahead);
  };
  _logged = false;

  // Precount: 4 beats op audio clock, dan start
  async startPlayPrecount(startSlot = 0) {
    this.init();
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
    return this._precount(startSlot, false);
  }

  async startRecordPrecount(startSlot = 0) {
    this.init();
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
    this.isRecording = true;
    return this._precount(startSlot, true);
  }

  _precount(startSlot, isRecordingMode) {
    const intervalSecs = 60.0 / this.bpm;
    const now = this.audioCtx.currentTime;

    // 4 beeps op de audio clock — start onmiddellijk
    for (let i = 0; i < 4; i++) {
      const t = now + i * intervalSecs;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.frequency.value = i === 0 ? 1000 : 500;
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.start(t);
      osc.stop(t + 0.1);
      // Visuele countdown gekoppeld aan audio clock
      setTimeout(() => this.onPrecount(4 - i), (t - now) * 1000);
    }

    // Song start precies na beat 4 (direct na de 4e tel)
    const startTime = now + 4 * intervalSecs;
    return new Promise((resolve) => {
      this.timerID = setTimeout(() => {
        this.onPrecount(0);
        this.isPlaying = true;
        this.isRecording = isRecordingMode;
        if (startSlot !== null) {
          this.currentSlot = startSlot;
          this.loopStart = startSlot;
        }
        // Zorg dat eerste noot zeker in de toekomst valt
        this.nextNoteTime = Math.max(this.audioCtx.currentTime + 0.05, startTime);
        // Cursor referentie = exact dezelfde tijd als de eerste noot
        this.playStartAudioTime = this.nextNoteTime;
        this.scheduler();
        resolve();
      }, (startTime - now) * 1000);
    });
  }

  async play(isRecordingMode = false, startSlot = null) {
    this.init();
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.isPlaying = true;
    this.isRecording = isRecordingMode;
    if (startSlot !== null) {
      this.currentSlot = startSlot;
      this.loopStart = startSlot; // Loop terug naar dit punt
    }
    this._logged = false;
    this.playStartAudioTime = this.audioCtx.currentTime + 0.05;
    this.nextNoteTime = this.playStartAudioTime;
    this.scheduler();
  }

  pause() {
    this.isPlaying = false;
    this.isRecording = false;
    clearTimeout(this.timerID);
  }

  setCurrentSlot(slot) {
    this.currentSlot = slot;
    this.onTick(slot); // Update UI immediately
  }

  stop() {
    this.isPlaying = false;
    this.isRecording = false;
    clearTimeout(this.timerID);
    // Do NOT emit onPrecount(0) here, because 0 means "start recording" to the App.
    // Do NOT emit onTick(0) here, because the user wants their cursor left alone.
  }

  setBpm(newBpm) {
    this.bpm = newBpm;
  }
}
