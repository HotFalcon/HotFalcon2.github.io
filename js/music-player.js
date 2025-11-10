// YouTube IFrame API
let player;
let playlist = [];
let currentVideoIndex = 0;
let isShuffled = false;
let originalPlaylist = [];
let apiReady = false;
let progressInterval = null;

// Load YouTube IFrame API
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// This function will be called when the API is ready
function onYouTubeIframeAPIReady() {
    console.log('YouTube IFrame API is ready');
    apiReady = true;
    const loadButton = document.getElementById('loadPlaylist');
    loadButton.disabled = false;
    loadButton.textContent = 'Load Playlist';
}

// Extract playlist or video ID from URL
function extractId(url) {
    // Try to match playlist first
    const playlistMatch = url.match(/[?&]list=([^&#]+)/);
    if (playlistMatch) {
        return { type: 'playlist', id: playlistMatch[1] };
    }

    // Match various YouTube video URL formats
    let videoMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);

    // Also try to match v parameter anywhere in the URL
    if (!videoMatch) {
        videoMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    }

    if (videoMatch) {
        return { type: 'video', id: videoMatch[1] };
    }

    return null;
}

// Shuffle array
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Load playlist or video
document.getElementById('loadPlaylist').addEventListener('click', function() {
    if (!apiReady) {
        showError('YouTube API is still loading, please wait...');
        return;
    }

    const url = document.getElementById('playlistInput').value.trim();

    if (!url) {
        showError('Please enter a YouTube URL');
        return;
    }

    const extracted = extractId(url);

    if (!extracted) {
        showError('Invalid YouTube URL. Please enter a valid playlist or video URL.');
        return;
    }

    hideError();
    loadYouTubeContent(extracted);
});

// Load YouTube content
function loadYouTubeContent(extracted) {
    const playerContainer = document.getElementById('playerContainer');
    playerContainer.style.display = 'block';

    if (player) {
        player.destroy();
    }

    const playerVars = {
        autoplay: 0,
        controls: 1,
        modestbranding: 1,
        rel: 0
    };

    if (extracted.type === 'playlist') {
        playerVars.list = extracted.id;
        playerVars.listType = 'playlist';
    }

    try {
        player = new YT.Player('player', {
            height: '390',
            width: '640',
            videoId: extracted.type === 'video' ? extracted.id : undefined,
            playerVars: playerVars,
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError
            }
        });
    } catch (error) {
        showError('Failed to load video: ' + error.message);
        console.error('Player creation error:', error);
    }
}

// Player error event
function onPlayerError(event) {
    let errorMessage = 'An error occurred while loading the video.';

    switch(event.data) {
        case 2:
            errorMessage = 'Invalid video ID. Please check the URL.';
            break;
        case 5:
            errorMessage = 'HTML5 player error. Try a different browser.';
            break;
        case 100:
            errorMessage = 'Video not found or has been removed.';
            break;
        case 101:
        case 150:
            errorMessage = 'Video cannot be embedded. Try opening it directly on YouTube.';
            break;
    }

    showError(errorMessage);
    console.error('Player error:', event.data);
}

// Player ready event
function onPlayerReady(event) {
    console.log('Player is ready');

    // Enable controls
    document.getElementById('playPauseBtn').disabled = false;
    document.getElementById('nextBtn').disabled = false;
    document.getElementById('prevBtn').disabled = false;
    document.getElementById('shuffleBtn').disabled = false;

    // Set initial volume
    const volumeSlider = document.getElementById('volumeSlider');
    player.setVolume(volumeSlider.value);

    // Update video info
    updateVideoInfo();

    // Clear any existing progress interval and start a new one
    if (progressInterval) {
        clearInterval(progressInterval);
    }
    progressInterval = setInterval(updateProgress, 1000);

    // Try to get playlist info
    try {
        const playlistData = player.getPlaylist();
        if (playlistData && playlistData.length > 0) {
            playlist = playlistData;
            originalPlaylist = [...playlistData];
            document.getElementById('playlistInfo').style.display = 'block';
            document.getElementById('videoCount').textContent = playlistData.length;
            updatePlaylistIndex();
        }
    } catch (e) {
        console.log('No playlist data available');
    }
}

// Player state change event
function onPlayerStateChange(event) {
    const playIcon = document.getElementById('playIcon');
    const pauseIcon = document.getElementById('pauseIcon');

    if (event.data === YT.PlayerState.PLAYING) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
        updateVideoInfo();
    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    }

    if (event.data === YT.PlayerState.ENDED) {
        // Auto-play next video
        playNext();
    }
}

// Update video info
function updateVideoInfo() {
    if (!player || !player.getVideoData) return;

    const videoData = player.getVideoData();
    const videoId = videoData.video_id;

    if (videoId) {
        // Update title and channel
        document.getElementById('videoTitle').textContent = videoData.title || 'Playing...';
        document.getElementById('channelName').textContent = videoData.author || '';

        // Update thumbnail
        const thumbnail = document.getElementById('thumbnail');
        thumbnail.src = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        thumbnail.style.display = 'block';

        // Handle thumbnail error (fallback to lower quality)
        thumbnail.onerror = function() {
            this.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            this.onerror = null;
        };

        updatePlaylistIndex();
    }
}

// Update playlist index
function updatePlaylistIndex() {
    try {
        const index = player.getPlaylistIndex();
        if (index !== -1 && index !== undefined) {
            document.getElementById('currentIndex').textContent = index + 1;
        }
    } catch (e) {
        console.log('Could not get playlist index');
    }
}

// Update progress bar
function updateProgress() {
    if (!player || !player.getCurrentTime || !player.getDuration) return;

    const currentTime = player.getCurrentTime();
    const duration = player.getDuration();

    if (duration > 0) {
        const progress = (currentTime / duration) * 100;
        document.getElementById('progressFill').style.width = progress + '%';

        document.getElementById('currentTime').textContent = formatTime(currentTime);
        document.getElementById('duration').textContent = formatTime(duration);
    }
}

// Format time
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Play/Pause button
document.getElementById('playPauseBtn').addEventListener('click', function() {
    if (!player) return;

    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
});

// Next button
document.getElementById('nextBtn').addEventListener('click', function() {
    playNext();
});

// Previous button
document.getElementById('prevBtn').addEventListener('click', function() {
    if (!player) return;

    try {
        player.previousVideo();
        setTimeout(updateVideoInfo, 500);
    } catch (e) {
        console.log('Previous video not available');
    }
});

// Play next video
function playNext() {
    if (!player) return;

    try {
        if (isShuffled && playlist.length > 0) {
            // Play random video from playlist
            const randomIndex = Math.floor(Math.random() * playlist.length);
            player.playVideoAt(randomIndex);
        } else {
            player.nextVideo();
        }
        setTimeout(updateVideoInfo, 500);
    } catch (e) {
        console.log('Next video not available');
    }
}

// Shuffle button
document.getElementById('shuffleBtn').addEventListener('click', function() {
    isShuffled = !isShuffled;
    this.style.background = isShuffled ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f0f0f0';
    this.style.color = isShuffled ? 'white' : '#333';

    if (isShuffled && playlist.length > 0) {
        // Shuffle and play random video
        playNext();
    }
});

// Volume slider
document.getElementById('volumeSlider').addEventListener('input', function() {
    const volume = this.value;
    document.getElementById('volumeValue').textContent = volume + '%';

    if (player && player.setVolume) {
        player.setVolume(volume);
    }
});

// Progress bar click
document.querySelector('.progress-bar').addEventListener('click', function(e) {
    if (!player || !player.getDuration) return;

    const rect = this.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const duration = player.getDuration();

    if (duration > 0) {
        const seekTime = duration * percentage;
        player.seekTo(seekTime, true);
    }
});

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

// Hide error message
function hideError() {
    document.getElementById('errorMessage').style.display = 'none';
}

// Load default playlist on Enter key
document.getElementById('playlistInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('loadPlaylist').click();
    }
});
