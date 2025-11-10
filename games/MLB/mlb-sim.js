// MLB Stats API Configuration
const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';
const CURRENT_SEASON = 2024;

// Team IDs from MLB Stats API
const MLB_TEAMS = {
    'LAD': { id: 119, name: 'Los Angeles Dodgers', abbr: 'LAD' },
    'NYY': { id: 147, name: 'New York Yankees', abbr: 'NYY' },
    'ATL': { id: 144, name: 'Atlanta Braves', abbr: 'ATL' },
    'HOU': { id: 117, name: 'Houston Astros', abbr: 'HOU' },
    'BAL': { id: 110, name: 'Baltimore Orioles', abbr: 'BAL' },
    'PHI': { id: 143, name: 'Philadelphia Phillies', abbr: 'PHI' },
    'SDP': { id: 135, name: 'San Diego Padres', abbr: 'SDP' },
    'TBR': { id: 139, name: 'Tampa Bay Rays', abbr: 'TBR' }
};

// Former Braves Greats with Career Stats
const BRAVES_LEGENDS = [
    {
        name: 'Hank Aaron',
        avg: 0.305,
        obp: 0.374,
        slg: 0.555,
        power: 0.450,
        speed: 0.700,
        contact: 0.900,
        position: 'RF'
    },
    {
        name: 'Chipper Jones',
        avg: 0.303,
        obp: 0.401,
        slg: 0.529,
        power: 0.380,
        speed: 0.550,
        contact: 0.880,
        position: '3B'
    },
    {
        name: 'Dale Murphy',
        avg: 0.265,
        obp: 0.346,
        slg: 0.469,
        power: 0.360,
        speed: 0.750,
        contact: 0.780,
        position: 'CF'
    },
    {
        name: 'Greg Maddux (Batting)',
        avg: 0.171,
        obp: 0.207,
        slg: 0.210,
        power: 0.020,
        speed: 0.300,
        contact: 0.600,
        position: 'P'
    },
    {
        name: 'John Smoltz (Batting)',
        avg: 0.154,
        obp: 0.201,
        slg: 0.200,
        power: 0.030,
        speed: 0.350,
        contact: 0.580,
        position: 'P'
    },
    {
        name: 'Tom Glavine (Batting)',
        avg: 0.186,
        obp: 0.227,
        slg: 0.229,
        power: 0.025,
        speed: 0.320,
        contact: 0.620,
        position: 'P'
    },
    {
        name: 'Andruw Jones',
        avg: 0.254,
        obp: 0.337,
        slg: 0.486,
        power: 0.400,
        speed: 0.750,
        contact: 0.740,
        position: 'CF'
    },
    {
        name: 'Fred McGriff',
        avg: 0.284,
        obp: 0.377,
        slg: 0.509,
        power: 0.380,
        speed: 0.450,
        contact: 0.820,
        position: '1B'
    },
    {
        name: 'Brian McCann',
        avg: 0.262,
        obp: 0.336,
        slg: 0.446,
        power: 0.280,
        speed: 0.400,
        contact: 0.780,
        position: 'C'
    }
];

// Game State
let gameState = {
    awayTeam: null,
    homeTeam: null,
    inning: 1,
    topOfInning: true,
    outs: 0,
    balls: 0,
    strikes: 0,
    bases: [false, false, false],
    awayScore: [0,0,0,0,0,0,0,0,0],
    homeScore: [0,0,0,0,0,0,0,0,0],
    awayHits: 0,
    homeHits: 0,
    awayErrors: 0,
    homeErrors: 0,
    currentBatterIndex: 0,
    playLog: [],
    isGameOver: false,
    autoPlaying: false,
    loadingTeams: false
};

// Team rosters cache
let teamRosters = {};

// Fetch team roster from MLB API
async function fetchTeamRoster(teamKey) {
    const team = MLB_TEAMS[teamKey];

    try {
        showLoadingMessage(`Loading ${team.name} roster...`);

        // Fetch roster
        const rosterResponse = await fetch(
            `${MLB_API_BASE}/teams/${team.id}/roster?rosterType=active&season=${CURRENT_SEASON}`
        );

        if (!rosterResponse.ok) {
            throw new Error(`Failed to fetch roster: ${rosterResponse.status}`);
        }

        const rosterData = await rosterResponse.json();
        const roster = rosterData.roster || [];

        // Filter to get position players (not pitchers)
        const positionPlayers = roster.filter(player => {
            const pos = player.position?.abbreviation || '';
            return !['P', 'RP', 'SP', 'CP'].includes(pos);
        });

        // Limit to 9 players
        const selectedPlayers = positionPlayers.slice(0, 9);

        // Fetch stats for each player
        const lineup = [];
        for (let i = 0; i < selectedPlayers.length; i++) {
            const player = selectedPlayers[i];
            const stats = await fetchPlayerStats(player.person.id, player.person.fullName);
            lineup.push(stats);
        }

        // If we're fetching Braves, add option to use legends
        if (teamKey === 'ATL') {
            teamRosters[teamKey + '_LEGENDS'] = {
                name: team.name + ' Legends',
                lineup: BRAVES_LEGENDS,
                abbr: 'ATL'
            };
        }

        teamRosters[teamKey] = {
            name: team.name,
            lineup: lineup,
            abbr: team.abbr
        };

        return teamRosters[teamKey];

    } catch (error) {
        console.error(`Error fetching roster for ${team.name}:`, error);
        showErrorMessage(`Failed to load ${team.name} roster. Using backup data.`);

        // Return backup default lineup
        return createBackupLineup(teamKey);
    }
}

// Fetch player stats from MLB API
async function fetchPlayerStats(playerId, playerName) {
    try {
        const statsResponse = await fetch(
            `${MLB_API_BASE}/people/${playerId}/stats?stats=season&season=${CURRENT_SEASON}&group=hitting`
        );

        if (!statsResponse.ok) {
            throw new Error(`Failed to fetch stats for ${playerName}`);
        }

        const statsData = await statsResponse.json();

        // Extract batting stats
        const splits = statsData.stats?.[0]?.splits || [];

        if (splits.length === 0) {
            // No stats available, use defaults
            return {
                name: playerName,
                avg: 0.250,
                obp: 0.320,
                slg: 0.400,
                power: 0.180,
                speed: 0.600,
                contact: 0.750
            };
        }

        const statLine = splits[0].stat;

        // Calculate derived stats
        const avg = parseFloat(statLine.avg) || 0.250;
        const obp = parseFloat(statLine.obp) || 0.320;
        const slg = parseFloat(statLine.slg) || 0.400;

        // Calculate power rating from home run rate
        const atBats = statLine.atBats || 400;
        const homeRuns = statLine.homeRuns || 10;
        const power = Math.min((homeRuns / atBats) * 2.5, 0.5); // Scale to 0-0.5

        // Calculate speed from stolen bases
        const stolenBases = statLine.stolenBases || 5;
        const speed = Math.min(0.4 + (stolenBases / 50), 1.0); // Scale to 0.4-1.0

        // Calculate contact from strikeout rate
        const strikeOuts = statLine.strikeOuts || 80;
        const contact = Math.max(1.0 - (strikeOuts / atBats), 0.5); // Scale to 0.5-1.0

        return {
            name: playerName,
            avg: avg,
            obp: obp,
            slg: slg,
            power: power,
            speed: speed,
            contact: contact,
            realStats: statLine // Store raw stats for reference
        };

    } catch (error) {
        console.error(`Error fetching stats for ${playerName}:`, error);

        // Return default stats
        return {
            name: playerName,
            avg: 0.250,
            obp: 0.320,
            slg: 0.400,
            power: 0.180,
            speed: 0.600,
            contact: 0.750
        };
    }
}

// Create backup lineup if API fails
function createBackupLineup(teamKey) {
    const team = MLB_TEAMS[teamKey];
    const defaultLineup = [];

    for (let i = 1; i <= 9; i++) {
        defaultLineup.push({
            name: `${team.abbr} Player ${i}`,
            avg: 0.250,
            obp: 0.320,
            slg: 0.400,
            power: 0.200,
            speed: 0.600,
            contact: 0.750
        });
    }

    return {
        name: team.name,
        lineup: defaultLineup,
        abbr: team.abbr
    };
}

// Show loading message
function showLoadingMessage(message) {
    const playLog = document.getElementById('playLog');
    if (playLog) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'play-item';
        loadingDiv.style.background = 'rgba(100, 100, 255, 0.3)';
        loadingDiv.textContent = message;
        loadingDiv.id = 'loading-message';

        // Remove old loading message if exists
        const oldLoading = document.getElementById('loading-message');
        if (oldLoading) oldLoading.remove();

        playLog.insertBefore(loadingDiv, playLog.firstChild);
    }
}

// Show error message
function showErrorMessage(message) {
    const playLog = document.getElementById('playLog');
    if (playLog) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'play-item important';
        errorDiv.textContent = '⚠️ ' + message;
        playLog.insertBefore(errorDiv, playLog.firstChild);
    }
}

// Initialize team selects
async function initTeamSelects() {
    const awaySelect = document.getElementById('awayTeam');
    const homeSelect = document.getElementById('homeTeam');

    for (let teamKey in MLB_TEAMS) {
        const team = MLB_TEAMS[teamKey];
        awaySelect.innerHTML += `<option value="${teamKey}">${team.name}</option>`;
        homeSelect.innerHTML += `<option value="${teamKey}">${team.name}</option>`;
    }

    // Add Braves Legends option
    awaySelect.innerHTML += `<option value="ATL_LEGENDS">Atlanta Braves Legends</option>`;
    homeSelect.innerHTML += `<option value="ATL_LEGENDS">Atlanta Braves Legends</option>`;
}

// Start game
async function startGame() {
    const awayTeamKey = document.getElementById('awayTeam').value;
    const homeTeamKey = document.getElementById('homeTeam').value;

    if (!awayTeamKey || !homeTeamKey) {
        alert('Please select both teams!');
        return;
    }

    if (awayTeamKey === homeTeamKey) {
        alert('Please select different teams!');
        return;
    }

    // Disable start button while loading
    const startBtn = document.getElementById('startBtn');
    startBtn.disabled = true;
    startBtn.textContent = 'Loading Teams...';

    gameState.loadingTeams = true;

    try {
        // Fetch team rosters if not cached
        if (awayTeamKey === 'ATL_LEGENDS') {
            // Make sure we have Braves data loaded
            if (!teamRosters['ATL'] && !teamRosters['ATL_LEGENDS']) {
                await fetchTeamRoster('ATL');
            }
            gameState.awayTeam = teamRosters['ATL_LEGENDS'];
        } else if (!teamRosters[awayTeamKey]) {
            await fetchTeamRoster(awayTeamKey);
            gameState.awayTeam = teamRosters[awayTeamKey];
        } else {
            gameState.awayTeam = teamRosters[awayTeamKey];
        }

        if (homeTeamKey === 'ATL_LEGENDS') {
            // Make sure we have Braves data loaded
            if (!teamRosters['ATL'] && !teamRosters['ATL_LEGENDS']) {
                await fetchTeamRoster('ATL');
            }
            gameState.homeTeam = teamRosters['ATL_LEGENDS'];
        } else if (!teamRosters[homeTeamKey]) {
            await fetchTeamRoster(homeTeamKey);
            gameState.homeTeam = teamRosters[homeTeamKey];
        } else {
            gameState.homeTeam = teamRosters[homeTeamKey];
        }

        gameState.awayTeam.key = awayTeamKey;
        gameState.homeTeam.key = homeTeamKey;

        // Remove loading message
        const loadingMsg = document.getElementById('loading-message');
        if (loadingMsg) loadingMsg.remove();

        document.getElementById('teamSelection').style.display = 'none';
        document.getElementById('gameArea').style.display = 'block';
        document.getElementById('scoreboard').classList.add('active');

        updateDisplay();
        addPlayLog(`⚾ Game Start: ${gameState.awayTeam.name} @ ${gameState.homeTeam.name}`, true);

        gameState.loadingTeams = false;

    } catch (error) {
        console.error('Error starting game:', error);
        alert('Failed to load team data. Please try again.');
        startBtn.disabled = false;
        startBtn.textContent = 'Start Game';
        gameState.loadingTeams = false;
    }
}

// Simulate a single at-bat outcome
function simulateAtBat(batter) {
    const battingTeam = gameState.topOfInning ? gameState.awayTeam : gameState.homeTeam;
    const pitcher = gameState.topOfInning ? gameState.homeTeam : gameState.awayTeam;

    // Adjust for pitcher (simplified - using league average ERA ~4.00)
    const pitcherQuality = 0.95;

    // Calculate probabilities based on batter stats
    const walkProb = batter.obp - batter.avg;
    const strikeoutProb = (1 - batter.contact) * 0.25;
    const homerunProb = batter.power * 0.35;
    const extraBaseProb = (batter.slg - batter.avg) * 0.4;
    const hitProb = batter.avg * pitcherQuality;

    // Random outcome
    const roll = Math.random();

    if (roll < walkProb) {
        return { type: 'walk', bases: 0 };
    } else if (roll < walkProb + strikeoutProb) {
        return { type: 'strikeout', bases: 0 };
    } else if (roll < walkProb + strikeoutProb + homerunProb) {
        return { type: 'homerun', bases: 4 };
    } else if (roll < walkProb + strikeoutProb + homerunProb + hitProb) {
        // Determine hit type based on power and speed
        const hitRoll = Math.random();
        if (hitRoll < 0.05 + (batter.power * 0.1)) {
            return { type: 'triple', bases: 3 };
        } else if (hitRoll < 0.25 + (batter.power * 0.2)) {
            return { type: 'double', bases: 2 };
        } else {
            return { type: 'single', bases: 1 };
        }
    } else {
        // Out - determine type
        const outRoll = Math.random();
        if (outRoll < 0.4) {
            return { type: 'groundout', bases: 0 };
        } else if (outRoll < 0.85) {
            return { type: 'flyout', bases: 0 };
        } else {
            return { type: 'lineout', bases: 0 };
        }
    }
}

// Handle at-bat result
function handleAtBatResult(batter, result) {
    let runsScored = 0;
    let message = '';

    switch(result.type) {
        case 'walk':
            message = `${batter.name} walks.`;
            runsScored = advanceRunners(1, false);
            break;

        case 'strikeout':
            gameState.outs++;
            message = `${batter.name} strikes out. ${gameState.outs} out(s).`;
            break;

        case 'single':
            message = `${batter.name} singles!`;
            if (gameState.topOfInning) gameState.awayHits++;
            else gameState.homeHits++;
            runsScored = advanceRunners(1, false);
            break;

        case 'double':
            message = `${batter.name} doubles!`;
            if (gameState.topOfInning) gameState.awayHits++;
            else gameState.homeHits++;
            runsScored = advanceRunners(2, false);
            break;

        case 'triple':
            message = `${batter.name} triples!`;
            if (gameState.topOfInning) gameState.awayHits++;
            else gameState.homeHits++;
            runsScored = advanceRunners(3, false);
            break;

        case 'homerun':
            message = `${batter.name} HITS A HOME RUN! 💥`;
            if (gameState.topOfInning) gameState.awayHits++;
            else gameState.homeHits++;
            runsScored = advanceRunners(4, false);
            break;

        case 'groundout':
            gameState.outs++;
            message = `${batter.name} grounds out. ${gameState.outs} out(s).`;
            if (gameState.bases[0] && gameState.outs < 3) {
                runsScored = advanceRunners(1, true);
            }
            break;

        case 'flyout':
            gameState.outs++;
            message = `${batter.name} flies out. ${gameState.outs} out(s).`;
            if (gameState.bases[2] && gameState.outs < 3 && Math.random() > 0.3) {
                gameState.bases[2] = false;
                runsScored = 1;
                message += ' Runner tags from third and scores!';
            }
            break;

        case 'lineout':
            gameState.outs++;
            message = `${batter.name} lines out. ${gameState.outs} out(s).`;
            break;
    }

    // Add runs
    if (runsScored > 0) {
        const currentInningIndex = gameState.inning - 1;
        if (gameState.topOfInning) {
            gameState.awayScore[currentInningIndex] += runsScored;
        } else {
            gameState.homeScore[currentInningIndex] += runsScored;
        }
        message += ` ${runsScored} run(s) score!`;
    }

    addPlayLog(message, runsScored > 0 || result.type === 'homerun');

    // Check for 3 outs
    if (gameState.outs >= 3) {
        endHalfInning();
    }
}

// Advance runners on base
function advanceRunners(bases, isOut) {
    let runsScored = 0;
    const newBases = [false, false, false];

    // Move existing runners
    for (let i = 2; i >= 0; i--) {
        if (gameState.bases[i]) {
            const newPosition = i + bases;
            if (newPosition >= 3) {
                runsScored++;
            } else {
                newBases[newPosition] = true;
            }
        }
    }

    // Add batter to base (if not an out)
    if (!isOut && bases > 0 && bases < 4) {
        newBases[bases - 1] = true;
    } else if (bases === 4) {
        runsScored++;
    }

    gameState.bases = newBases;
    return runsScored;
}

// End half inning
function endHalfInning() {
    const halfInning = gameState.topOfInning ? 'Top' : 'Bottom';
    addPlayLog(`End of ${halfInning} of inning ${gameState.inning}`, true);

    gameState.outs = 0;
    gameState.bases = [false, false, false];

    if (!gameState.topOfInning) {
        if (gameState.inning >= 9) {
            const awayTotal = gameState.awayScore.reduce((a, b) => a + b, 0);
            const homeTotal = gameState.homeScore.reduce((a, b) => a + b, 0);

            if (homeTotal > awayTotal) {
                endGame();
                return;
            } else if (homeTotal < awayTotal) {
                endGame();
                return;
            }
        }
        gameState.inning++;
        if (gameState.inning > 9) {
            gameState.awayScore.push(0);
            gameState.homeScore.push(0);
        }
    }

    gameState.topOfInning = !gameState.topOfInning;
    updateDisplay();
}

// End game
function endGame() {
    gameState.isGameOver = true;
    gameState.autoPlaying = false;

    const awayTotal = gameState.awayScore.reduce((a, b) => a + b, 0);
    const homeTotal = gameState.homeScore.reduce((a, b) => a + b, 0);

    const winner = homeTotal > awayTotal ? gameState.homeTeam.name : gameState.awayTeam.name;
    const finalScore = `${awayTotal}-${homeTotal}`;

    addPlayLog(`🏆 FINAL: ${winner} wins ${finalScore}!`, true);

    document.getElementById('nextPlayBtn').disabled = true;
    document.getElementById('autoPlayBtn').disabled = true;
}

// Next play
function nextPlay() {
    if (gameState.isGameOver) return;

    const battingTeam = gameState.topOfInning ? gameState.awayTeam : gameState.homeTeam;
    const batter = battingTeam.lineup[gameState.currentBatterIndex];

    const result = simulateAtBat(batter);
    handleAtBatResult(batter, result);

    gameState.currentBatterIndex = (gameState.currentBatterIndex + 1) % 9;

    updateDisplay();
}

// Auto play
function autoPlay() {
    if (gameState.autoPlaying) {
        gameState.autoPlaying = false;
        document.getElementById('autoPlayBtn').textContent = 'Auto Play ▶';
        return;
    }

    gameState.autoPlaying = true;
    document.getElementById('autoPlayBtn').textContent = 'Pause ⏸';

    function playNext() {
        if (!gameState.autoPlaying || gameState.isGameOver) {
            gameState.autoPlaying = false;
            document.getElementById('autoPlayBtn').textContent = 'Auto Play ▶';
            return;
        }

        nextPlay();
        setTimeout(playNext, 800);
    }

    playNext();
}

// New game
function newGame() {
    gameState = {
        awayTeam: null,
        homeTeam: null,
        inning: 1,
        topOfInning: true,
        outs: 0,
        balls: 0,
        strikes: 0,
        bases: [false, false, false],
        awayScore: [0,0,0,0,0,0,0,0,0],
        homeScore: [0,0,0,0,0,0,0,0,0],
        awayHits: 0,
        homeHits: 0,
        awayErrors: 0,
        homeErrors: 0,
        currentBatterIndex: 0,
        playLog: [],
        isGameOver: false,
        autoPlaying: false,
        loadingTeams: false
    };

    document.getElementById('teamSelection').style.display = 'block';
    document.getElementById('gameArea').style.display = 'none';
    document.getElementById('awayTeam').value = '';
    document.getElementById('homeTeam').value = '';
    document.getElementById('nextPlayBtn').disabled = false;
    document.getElementById('autoPlayBtn').disabled = false;
    document.getElementById('autoPlayBtn').textContent = 'Auto Play ▶';
    document.getElementById('startBtn').disabled = false;
    document.getElementById('startBtn').textContent = 'Start Game';

    // Clear play log
    document.getElementById('playLog').innerHTML = '<h3>Play-by-Play</h3>';
}

// Update display
function updateDisplay() {
    if (!gameState.awayTeam || !gameState.homeTeam) return;

    updateScoreboard();

    document.getElementById('base1').classList.toggle('occupied', gameState.bases[0]);
    document.getElementById('base2').classList.toggle('occupied', gameState.bases[1]);
    document.getElementById('base3').classList.toggle('occupied', gameState.bases[2]);

    document.getElementById('out1').classList.toggle('active', gameState.outs >= 1);
    document.getElementById('out2').classList.toggle('active', gameState.outs >= 2);
    document.getElementById('out3').classList.toggle('active', gameState.outs >= 3);

    const halfInning = gameState.topOfInning ? 'Top' : 'Bottom';
    document.getElementById('inningDisplay').textContent = `${halfInning} ${gameState.inning}`;

    const battingTeam = gameState.topOfInning ? gameState.awayTeam : gameState.homeTeam;
    const batter = battingTeam.lineup[gameState.currentBatterIndex];
    document.getElementById('currentBatter').innerHTML = `
        Now Batting: ${batter.name}
        <div class="stats">AVG: ${batter.avg.toFixed(3)} | OBP: ${batter.obp.toFixed(3)} | SLG: ${batter.slg.toFixed(3)}</div>
    `;

    document.getElementById('countDisplay').textContent = `${gameState.outs} Out${gameState.outs !== 1 ? 's' : ''}`;
}

// Update scoreboard
function updateScoreboard() {
    const awayTotal = gameState.awayScore.reduce((a, b) => a + b, 0);
    const homeTotal = gameState.homeScore.reduce((a, b) => a + b, 0);

    let awayHtml = `<div class="team-name">${gameState.awayTeam.name}</div>`;
    for (let i = 0; i < 9; i++) {
        awayHtml += `<div>${gameState.awayScore[i] || '-'}</div>`;
    }
    awayHtml += `<div style="font-weight: bold;">${awayTotal}</div>`;
    awayHtml += `<div>${gameState.awayHits}</div>`;
    awayHtml += `<div>${gameState.awayErrors}</div>`;
    document.getElementById('awayScore').innerHTML = awayHtml;

    let homeHtml = `<div class="team-name">${gameState.homeTeam.name}</div>`;
    for (let i = 0; i < 9; i++) {
        homeHtml += `<div>${gameState.homeScore[i] || '-'}</div>`;
    }
    homeHtml += `<div style="font-weight: bold;">${homeTotal}</div>`;
    homeHtml += `<div>${gameState.homeHits}</div>`;
    homeHtml += `<div>${gameState.homeErrors}</div>`;
    document.getElementById('homeScore').innerHTML = homeHtml;
}

// Add play to log
function addPlayLog(text, important = false) {
    gameState.playLog.unshift({ text, important });

    const playLogDiv = document.getElementById('playLog');
    const playItem = document.createElement('div');
    playItem.className = important ? 'play-item important' : 'play-item';
    playItem.textContent = text;

    playLogDiv.insertBefore(playItem, playLogDiv.firstChild);

    while (playLogDiv.children.length > 50) {
        playLogDiv.removeChild(playLogDiv.lastChild);
    }
}

// Initialize on load
window.addEventListener('load', initTeamSelects);
