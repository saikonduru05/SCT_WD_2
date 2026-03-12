const displayMain = document.getElementById("display-main");
const displayLapCurrent = document.getElementById("display-lap-current");
const lapList = document.getElementById("laps");
const ticksContainer = document.getElementById("ticks-container");
const subTicksContainer = document.getElementById("sub-ticks-container");
const mainNeedle = document.getElementById("main-needle");
const subNeedle = document.getElementById("sub-needle");
const actionBtn = document.getElementById("actionBtn");
const playIcon = document.getElementById("playIcon");
const container = document.getElementById("stopwatch-container");
const soundToggle = document.getElementById("soundToggle");

// --- Audio Manager (Web Audio API) ---
class AudioManager {
    constructor() {
        this.ctx = null;
        this.enabled = true; // Enabled by default
        this.tickCount = 0;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playTone(freq, type, duration, volume = 0.1) {
        if (!this.enabled || !this.ctx) return;

        this.init(); // Ensure context is ready
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    tickToc() {
        // Alternate between 880Hz (tick) and 440Hz (toc)
        const isTick = this.tickCount % 2 === 0;
        const freq = isTick ? 880 : 440;
        this.playTone(freq, 'sine', 0.05, 0.05);
        this.tickCount++;
    }

    click() { this.playTone(600, 'triangle', 0.03, 0.08); }
    lap() {
        this.playTone(660, 'sine', 0.1, 0.1);
        setTimeout(() => this.playTone(880, 'sine', 0.15, 0.08), 50);
    }
}

const audio = new AudioManager();

function toggleSound() {
    audio.enabled = !audio.enabled;
    if (audio.enabled) audio.init();
    soundToggle.innerText = audio.enabled ? "🔊" : "🔇";
    soundToggle.classList.toggle("muted", !audio.enabled);
}

// --- Stopwatch Logic ---
let ms = 0;
let sec = 0;
let min = 0;
let hr = 0;

let timer = null;
let lapCount = 0;
let lastLapTotalMs = 0;
let totalElapsedMs = 0;

// Initialize Dial Ticks
function initDials() {
    ticksContainer.innerHTML = '';
    subTicksContainer.innerHTML = '';

    for (let i = 0; i < 60; i++) {
        const tick = document.createElement("div");
        tick.className = "tick" + (i % 5 === 0 ? " tick-major" : "");
        tick.style.transform = `rotate(${i * 6}deg)`;
        ticksContainer.appendChild(tick);
    }

    for (let i = 0; i < 30; i++) {
        const tick = document.createElement("div");
        tick.className = "tick" + (i % 5 === 0 ? " tick-major" : "");
        tick.style.cssText = `position: absolute; top:0; left:50%; width:1px; height:4px; background:var(--text-muted); transform-origin: 0 45px; transform: rotate(${i * 12}deg);`;
        subTicksContainer.appendChild(tick);
    }
}

function formatTime(totalMs) {
    const h = Math.floor(totalMs / 360000);
    const m = Math.floor((totalMs % 360000) / 6000);
    const s = Math.floor((totalMs % 6000) / 100);
    const milli = totalMs % 100;

    const mm = m < 10 ? "0" + m : m;
    const ss = s < 10 ? "0" + s : s;
    const mmm = milli < 10 ? "0" + milli : milli;

    return { mm, ss, mmm, full: `${mm}:${ss}.${mmm}` };
}

function updateDisplay() {
    totalElapsedMs = (hr * 360000) + (min * 6000) + (sec * 100) + ms;
    const time = formatTime(totalElapsedMs);

    displayMain.innerHTML = `${time.mm}:<span class="teal">${time.ss}</span>.${time.mmm}`;

    const currentLapMs = totalElapsedMs - lastLapTotalMs;
    displayLapCurrent.innerText = formatTime(currentLapMs).full;

    const mainRotation = (totalElapsedMs % 6000) * 0.06;
    mainNeedle.style.transform = `translate(-50%, -100%) rotate(${mainRotation}deg)`;

    const subRotation = (totalElapsedMs % 180000) * 0.002;
    subNeedle.style.transform = `translate(-50%, -100%) rotate(${subRotation * 60}deg)`;
}

function stopwatch() {
    ms++;
    if (ms === 100) {
        ms = 0;
        sec++;
        audio.tickToc(); // Play tick-toc every second
    }
    if (sec === 60) { sec = 0; min++; }
    if (min === 60) { min = 0; hr++; }
    updateDisplay();
}

function toggleTimer() {
    audio.click();
    if (timer === null) {
        timer = setInterval(stopwatch, 10);
        playIcon.innerText = '⏸';
        actionBtn.classList.add("paused");
    } else {
        clearInterval(timer);
        timer = null;
        playIcon.innerText = '▶';
        actionBtn.classList.remove("paused");
    }
}

function resetTimer() {
    audio.click();
    clearInterval(timer);
    timer = null;
    ms = sec = min = hr = 0;
    lapCount = 0;
    lastLapTotalMs = 0;
    totalElapsedMs = 0;
    lapData.length = 0;
    audio.tickCount = 0;

    updateDisplay();
    lapList.innerHTML = "";
    playIcon.innerText = '▶';
    actionBtn.classList.remove("paused");
}

function updateRealTimeClock() {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    const s = now.getSeconds().toString().padStart(2, '0');
    const realTimeDisplay = document.getElementById("real-time-clock");
    if (realTimeDisplay) realTimeDisplay.innerText = `${h}:${m}:${s}`;
}

setInterval(updateRealTimeClock, 1000);
updateRealTimeClock();

const lapData = [];

function updateLapHighlights() {
    if (lapData.length < 2) return;

    let fastest = lapData[0];
    let slowest = lapData[0];

    lapData.forEach(lap => {
        if (lap.split < fastest.split) fastest = lap;
        if (lap.split > slowest.split) slowest = lap;
    });

    const items = lapList.getElementsByClassName('lap-item');
    for (let item of items) {
        item.classList.remove('fastest', 'slowest');
        const lapNumElem = item.querySelector('.lap-num-val');
        if (lapNumElem) {
            const lapNum = parseInt(lapNumElem.innerText);
            if (lapNum === fastest.num) item.classList.add('fastest');
            if (lapNum === slowest.num) item.classList.add('slowest');
        }
    }
}

function lapTimer() {
    if (totalElapsedMs === 0) return;
    audio.lap();

    const currentTotalTime = totalElapsedMs;
    const lapSplitMs = currentTotalTime - lastLapTotalMs;

    lapCount++;
    lapData.push({ num: lapCount, split: lapSplitMs, total: currentTotalTime });

    const lapTotalFormatted = formatTime(currentTotalTime).full;
    const lapSplitFormatted = formatTime(lapSplitMs).full;

    const li = document.createElement("li");
    li.classList.add("lap-item");

    li.innerHTML = `
        <span class="lap-num-val">${lapCount < 10 ? '0' + lapCount : lapCount}</span>
        <span class="lap-time-split">+${lapSplitFormatted}</span>
        <span class="lap-time-total">${lapTotalFormatted}</span>
    `;

    lapList.insertBefore(li, lapList.firstChild);
    lastLapTotalMs = currentTotalTime;

    updateLapHighlights();
}

initDials();
updateDisplay();
