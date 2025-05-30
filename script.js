// Get elements
const beetleBtn = document.getElementById('beetle-btn');
const seedBtn = document.getElementById('seed-btn');
const videoOverlay = document.getElementById('video-overlay');
const iframeOverlay = document.getElementById('iframe-overlay');
const overlayVideo = document.getElementById('overlay-video');
const iframeEmbed = document.getElementById('iframe-embed');
const iframeFallback = document.querySelector('.iframe-fallback');
const minimizeVideoBtn = document.getElementById('minimize-video-btn');
const minimizeIframeBtn = document.getElementById('minimize-iframe-btn');

// Show video overlay
beetleBtn.addEventListener('click', () => {
    videoOverlay.classList.remove('hidden');
    overlayVideo.play();
});

// Show iframe overlay
seedBtn.addEventListener('click', () => {
    iframeOverlay.classList.remove('hidden');
    // Check if iframe loaded successfully
    iframeEmbed.addEventListener('error', () => {
        iframeFallback.classList.remove('hidden');
    });
    // Fallback if iframe doesn't load within 5 seconds
    setTimeout(() => {
        if (!iframeEmbed.contentWindow) {
            iframeFallback.classList.remove('hidden');
        }
    }, 5000);
});

// Minimize video overlay
minimizeVideoBtn.addEventListener('click', () => {
    videoOverlay.classList.add('hidden');
    overlayVideo.pause();
});

// Minimize iframe overlay
minimizeIframeBtn.addEventListener('click', () => {
    iframeOverlay.classList.add('hidden');
    iframeFallback.classList.add('hidden'); // Hide fallback when closing
});