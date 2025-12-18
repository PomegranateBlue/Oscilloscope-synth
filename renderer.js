// Audio Context and nodes
let audioContext = null;
let analyser = null;
let masterGain = null;
let activeOscillators = {};

// Settings
let waveform = 'sine';
let baseFrequency = 261.63; // C4
let volume = 0.5;
let attack = 0.1;
let release = 0.3;

// Note frequencies relative to C4 (multipliers based on equal temperament)
const noteMultipliers = {
  'C': 1,
  'C#': Math.pow(2, 1/12),
  'D': Math.pow(2, 2/12),
  'D#': Math.pow(2, 3/12),
  'E': Math.pow(2, 4/12),
  'F': Math.pow(2, 5/12),
  'F#': Math.pow(2, 6/12),
  'G': Math.pow(2, 7/12),
  'G#': Math.pow(2, 8/12),
  'A': Math.pow(2, 9/12),
  'A#': Math.pow(2, 10/12),
  'B': Math.pow(2, 11/12),
  'C5': 2,
  'C#5': Math.pow(2, 13/12),
  'D5': Math.pow(2, 14/12),
  'D#5': Math.pow(2, 15/12),
  'E5': Math.pow(2, 16/12)
};

// Key to note mapping
const keyToNote = {
  'a': 'C',
  'w': 'C#',
  's': 'D',
  'e': 'D#',
  'd': 'E',
  'f': 'F',
  't': 'F#',
  'g': 'G',
  'y': 'G#',
  'h': 'A',
  'u': 'A#',
  'j': 'B',
  'k': 'C5',
  'o': 'C#5',
  'l': 'D5',
  'p': 'D#5',
  ';': 'E5'
};

// Canvas and oscilloscope
const canvas = document.getElementById('oscilloscope');
const ctx = canvas.getContext('2d');
let animationId = null;

// Initialize audio context on user interaction
function initAudio() {
  if (audioContext) return;

  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // Create analyser for oscilloscope
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;

  // Create master gain
  masterGain = audioContext.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(analyser);
  analyser.connect(audioContext.destination);

  // Start oscilloscope
  drawOscilloscope();
}

// Play a note
function playNote(note) {
  if (!audioContext) initAudio();
  if (activeOscillators[note]) return; // Already playing

  const frequency = baseFrequency * noteMultipliers[note];

  // Create oscillator
  const oscillator = audioContext.createOscillator();
  oscillator.type = waveform;
  oscillator.frequency.value = frequency;

  // Create gain for envelope
  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + attack);

  // Connect
  oscillator.connect(gainNode);
  gainNode.connect(masterGain);

  // Start
  oscillator.start();

  // Store reference
  activeOscillators[note] = { oscillator, gainNode };

  // Update UI
  updateCurrentNote(note, frequency);
  highlightKey(note, true);
}

// Stop a note
function stopNote(note) {
  if (!activeOscillators[note]) return;

  const { oscillator, gainNode } = activeOscillators[note];

  // Release envelope
  gainNode.gain.cancelScheduledValues(audioContext.currentTime);
  gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + release);

  // Stop oscillator after release
  oscillator.stop(audioContext.currentTime + release);

  delete activeOscillators[note];

  // Update UI
  highlightKey(note, false);

  if (Object.keys(activeOscillators).length === 0) {
    document.getElementById('currentNote').textContent = '-';
    document.getElementById('currentFreq').textContent = '-';
  }
}

// Update current note display
function updateCurrentNote(note, frequency) {
  document.getElementById('currentNote').textContent = note;
  document.getElementById('currentFreq').textContent = frequency.toFixed(2);
}

// Highlight key on keyboard
function highlightKey(note, active) {
  const keys = document.querySelectorAll('.key');
  keys.forEach(key => {
    if (key.dataset.note === note) {
      if (active) {
        key.classList.add('active');
      } else {
        key.classList.remove('active');
      }
    }
  });
}

// Draw oscilloscope
function drawOscilloscope() {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    animationId = requestAnimationFrame(draw);

    analyser.getByteTimeDomainData(dataArray);

    // Clear canvas with dark background
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = 1;

    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
      const x = (canvas.width / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Horizontal grid lines
    for (let i = 0; i <= 6; i++) {
      const y = (canvas.height / 6) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw center line
    ctx.strokeStyle = '#4a4a7a';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    // Draw waveform
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00ff88';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ff88';

    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  draw();
}

// Draw idle oscilloscope when no audio
function drawIdleOscilloscope() {
  ctx.fillStyle = '#0f0f1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid
  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 1;

  for (let i = 0; i <= 10; i++) {
    const x = (canvas.width / 10) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let i = 0; i <= 6; i++) {
    const y = (canvas.height / 6) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw flat line
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#00ff88';
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// Event listeners for controls
document.getElementById('waveform').addEventListener('change', (e) => {
  waveform = e.target.value;
  // Update any active oscillators
  Object.keys(activeOscillators).forEach(note => {
    activeOscillators[note].oscillator.type = waveform;
  });
});

document.getElementById('baseFrequency').addEventListener('input', (e) => {
  baseFrequency = parseFloat(e.target.value);
  document.getElementById('freqValue').textContent = baseFrequency.toFixed(2);
  // Update any active oscillators
  Object.keys(activeOscillators).forEach(note => {
    const frequency = baseFrequency * noteMultipliers[note];
    activeOscillators[note].oscillator.frequency.value = frequency;
    updateCurrentNote(note, frequency);
  });
});

document.getElementById('volume').addEventListener('input', (e) => {
  volume = parseInt(e.target.value) / 100;
  document.getElementById('volValue').textContent = e.target.value;
  if (masterGain) {
    masterGain.gain.value = volume;
  }
});

document.getElementById('attack').addEventListener('input', (e) => {
  attack = parseFloat(e.target.value);
  document.getElementById('attackValue').textContent = attack.toFixed(2);
});

document.getElementById('release').addEventListener('input', (e) => {
  release = parseFloat(e.target.value);
  document.getElementById('releaseValue').textContent = release.toFixed(2);
});

// Keyboard event listeners
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const note = keyToNote[e.key.toLowerCase()];
  if (note) {
    playNote(note);
  }
});

document.addEventListener('keyup', (e) => {
  const note = keyToNote[e.key.toLowerCase()];
  if (note) {
    stopNote(note);
  }
});

// Mouse/touch event listeners for on-screen keyboard
document.querySelectorAll('.key').forEach(key => {
  key.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const note = key.dataset.note;
    playNote(note);
  });

  key.addEventListener('mouseup', () => {
    const note = key.dataset.note;
    stopNote(note);
  });

  key.addEventListener('mouseleave', () => {
    const note = key.dataset.note;
    stopNote(note);
  });

  // Touch events
  key.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const note = key.dataset.note;
    playNote(note);
  });

  key.addEventListener('touchend', () => {
    const note = key.dataset.note;
    stopNote(note);
  });
});

// Draw initial oscilloscope
drawIdleOscilloscope();

// Initialize audio on first click anywhere
document.addEventListener('click', initAudio, { once: true });
document.addEventListener('keydown', initAudio, { once: true });
