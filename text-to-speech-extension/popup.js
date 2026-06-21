let paragraphs = [];
let currentParagraphIndex = -1;
let isPlaying = false;
let isPaused = false;
let synth = null;
let selectedVoice = null;

// DOM Elements
const voiceSelect = document.getElementById('voiceSelect');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const paragraphList = document.getElementById('paragraphList');
const statusDiv = document.getElementById('status');

// Initialize speech synthesis
function initSpeech() {
  synth = window.speechSynthesis;
  
  // Wait for voices to load
  function loadVoices() {
    const voices = synth.getVoices();
    if (voices.length > 0) {
      voiceSelect.innerHTML = '';
      voices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${voice.name} (${voice.lang})`;
        if (voice.default) {
          option.selected = true;
          selectedVoice = voice;
        }
        voiceSelect.appendChild(option);
      });
      
      if (selectedVoice === null && voices.length > 0) {
        selectedVoice = voices[0];
      }
    } else {
      setTimeout(loadVoices, 100);
    }
  }
  
  loadVoices();
  
  // Some browsers need this event
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
  }
}

// Voice selection change
voiceSelect.addEventListener('change', () => {
  const voices = synth.getVoices();
  const selectedIndex = parseInt(voiceSelect.value);
  if (!isNaN(selectedIndex) && voices[selectedIndex]) {
    selectedVoice = voices[selectedIndex];
  }
});

// Get paragraphs from active tab
async function getParagraphs() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error('No active tab found');
    }
    
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getParagraphs' });
    
    if (response && response.paragraphs) {
      return response.paragraphs;
    } else {
      throw new Error('No content found on page');
    }
  } catch (error) {
    console.error('Error getting paragraphs:', error);
    throw error;
  }
}

// Render paragraph list
function renderParagraphList() {
  if (paragraphs.length === 0) {
    paragraphList.innerHTML = '<div class="loading">No readable content found on this page</div>';
    return;
  }
  
  paragraphList.innerHTML = '';
  
  paragraphs.forEach((paragraph, index) => {
    const item = document.createElement('div');
    item.className = 'paragraph-item';
    if (index === currentParagraphIndex) {
      item.classList.add('active');
    }
    if (index < currentParagraphIndex) {
      item.classList.add('read');
    }
    
    // Truncate long paragraphs for display
    const displayText = paragraph.length > 150 
      ? paragraph.substring(0, 150) + '...' 
      : paragraph;
    
    item.textContent = displayText;
    item.title = paragraph; // Full text on hover
    
    item.addEventListener('click', () => {
      currentParagraphIndex = index;
      updateUI();
      speakCurrentParagraph();
    });
    
    paragraphList.appendChild(item);
  });
}

// Update UI state
function updateUI() {
  playBtn.disabled = isPlaying || paragraphs.length === 0;
  pauseBtn.disabled = !isPlaying || paragraphs.length === 0;
  stopBtn.disabled = !isPlaying && !isPaused || paragraphs.length === 0;
  nextBtn.disabled = paragraphs.length === 0;
  prevBtn.disabled = paragraphs.length === 0;
  
  if (currentParagraphIndex >= 0) {
    statusDiv.textContent = `Paragraph ${currentParagraphIndex + 1} of ${paragraphs.length}`;
  } else {
    statusDiv.textContent = isPlaying ? 'Playing...' : (isPaused ? 'Paused' : 'Ready');
  }
  
  renderParagraphList();
}

// Speak current paragraph
function speakCurrentParagraph() {
  if (currentParagraphIndex < 0 || currentParagraphIndex >= paragraphs.length) {
    return;
  }
  
  // Cancel any ongoing speech
  synth.cancel();
  
  const text = paragraphs[currentParagraphIndex];
  const utterance = new SpeechSynthesisUtterance(text);
  
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  
  utterance.onstart = () => {
    isPlaying = true;
    isPaused = false;
    updateUI();
  };
  
  utterance.onend = () => {
    isPlaying = false;
    isPaused = false;
    updateUI();
    
    // Auto-advance to next paragraph
    if (currentParagraphIndex < paragraphs.length - 1) {
      currentParagraphIndex++;
      updateUI();
      setTimeout(() => speakCurrentParagraph(), 500);
    } else {
      statusDiv.textContent = 'Finished reading';
    }
  };
  
  utterance.onerror = (event) => {
    console.error('Speech error:', event);
    isPlaying = false;
    isPaused = false;
    updateUI();
    statusDiv.textContent = 'Error occurred';
  };
  
  synth.speak(utterance);
  updateUI();
}

// Play/Pause/Stop handlers
playBtn.addEventListener('click', () => {
  if (isPaused) {
    synth.resume();
    isPaused = false;
    isPlaying = true;
  } else {
    if (currentParagraphIndex < 0) {
      currentParagraphIndex = 0;
    }
    speakCurrentParagraph();
  }
  updateUI();
});

pauseBtn.addEventListener('click', () => {
  if (isPlaying) {
    synth.pause();
    isPaused = true;
    isPlaying = false;
    updateUI();
    statusDiv.textContent = 'Paused';
  }
});

stopBtn.addEventListener('click', () => {
  synth.cancel();
  isPlaying = false;
  isPaused = false;
  currentParagraphIndex = -1;
  updateUI();
  statusDiv.textContent = 'Stopped';
});

nextBtn.addEventListener('click', () => {
  synth.cancel();
  if (currentParagraphIndex < paragraphs.length - 1) {
    currentParagraphIndex++;
    updateUI();
    speakCurrentParagraph();
  } else {
    statusDiv.textContent = 'Already at last paragraph';
  }
});

prevBtn.addEventListener('click', () => {
  synth.cancel();
  if (currentParagraphIndex > 0) {
    currentParagraphIndex--;
    updateUI();
    speakCurrentParagraph();
  } else {
    statusDiv.textContent = 'Already at first paragraph';
  }
});

// Initialize
initSpeech();

// Load paragraphs when popup opens
(async function loadContent() {
  try {
    paragraphs = await getParagraphs();
    updateUI();
    statusDiv.textContent = `Found ${paragraphs.length} paragraphs`;
  } catch (error) {
    paragraphList.innerHTML = `<div class="loading">Error: ${error.message}</div>`;
    statusDiv.textContent = 'Failed to load content';
  }
})();
