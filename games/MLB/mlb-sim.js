// MLB Stats API Configuration
const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';
const CURRENT_SEASON = 2025;

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
    { name: 'Hank Aaron', avg: 0.305, obp: 0.374, slg: 0.555, power: 0.450, speed: 0.700, contact: 0.900, position: 'RF' },
    { name: 'Chipper Jones', avg: 0.303, obp: 0.401, slg: 0.529, power: 0.380, speed: 0.550, contact: 0.880, position: '3B' },
    { name: 'Dale Murphy', avg: 0.265, obp: 0.346, slg: 0.469, power: 0.360, speed: 0.750, contact: 0.780, position: 'CF' },
    { name: 'Andruw Jones', avg: 0.254, obp: 0.337, slg: 0.486, power: 0.400, speed: 0.750, contact: 0.740, position: 'CF' },
    { name: 'Fred McGriff', avg: 0.284, obp: 0.377, slg: 0.509, power: 0.380, speed: 0.450, contact: 0.820, position: '1B' },
    { name: 'Brian McCann', avg: 0.262, obp: 0.336, slg: 0.446, power: 0.280, speed: 0.400, contact: 0.780, position: 'C' },
    { name: 'Eddie Mathews', avg: 0.271, obp: 0.376, slg: 0.509, power: 0.420, speed: 0.600, contact: 0.780, position: '3B' },
    { name: 'Bob Horner', avg: 0.277, obp: 0.340, slg: 0.499, power: 0.370, speed: 0.450, contact: 0.750, position: '3B' },
    { name: 'David Justice', avg: 0.279, obp: 0.365, slg: 0.500, power: 0.350, speed: 0.600, contact: 0.780, position: 'RF' }
];

const BRAVES_LEGEND_PITCHERS = [
    { name: 'Greg Maddux', era: 3.16, whip: 1.14, k9: 6.1, control: 0.950, stuff: 0.800 },
    { name: 'Tom Glavine', era: 3.54, whip: 1.31, k9: 5.4, control: 0.900, stuff: 0.750 },
    { name: 'John Smoltz', era: 3.33, whip: 1.18, k9: 8.2, control: 0.850, stuff: 0.880 },
    { name: 'Phil Niekro', era: 3.35, whip: 1.27, k9: 5.0, control: 0.870, stuff: 0.820 },
    { name: 'Warren Spahn', era: 3.09, whip: 1.19, k9: 4.4, control: 0.920, stuff: 0.850 }
];

// Game State
let gameState = {
    awayTeam: null,
    homeTeam: null,
    awayPitcher: null,
    homePitcher: null,
    inning: 1,
    topOfInning: true,
    outs: 0,
    balls: 0,
    strikes: 0,
    bases: [false, false, false],
    baseRunners: ['', '', ''], // Names of runners on base
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
let teamPitchers = {};

// Fetch team roster from MLB API
async function fetchTeamRoster(teamKey) {
    const team = MLB_TEAMS[teamKey];

    try {
        showLoadingMessage(`Loading ${team.name} roster...`);

        const rosterResponse = await fetch(
            `${MLB_API_BASE}/teams/${team.id}/roster?rosterType=active&season=${CURRENT_SEASON}`
        );

        if (!rosterResponse.ok) {
            throw new Error(`Failed to fetch roster: ${rosterResponse.status}`);
        }

        const rosterData = await rosterResponse.json();
        const roster = rosterData.roster || [];

        // Split pitchers and position players
        const pitchers = roster.filter(player => {
            const pos = player.position?.abbreviation || '';
            return ['P', 'RP', 'SP', 'CP'].includes(pos);
        });

        const positionPlayers = roster.filter(player => {
            const pos = player.position?.abbreviation || '';
            return !['P', 'RP', 'SP', 'CP'].includes(pos);
        });

        // Get position players
        const selectedPlayers = positionPlayers.slice(0, 9);
        const lineup = [];
        for (let i = 0; i < selectedPlayers.length; i++) {
            const player = selectedPlayers[i];
            const stats = await fetchPlayerStats(player.person.id, player.person.fullName);
            lineup.push(stats);
        }

        // Get pitchers
        const selectedPitchers = pitchers.slice(0, 5);
        const pitchersList = [];
        for (let i = 0; i < selectedPitchers.length; i++) {
            const pitcher = selectedPitchers[i];
            const stats = await fetchPitcherStats(pitcher.person.id, pitcher.person.fullName);
            pitchersList.push(stats);
        }

        // Handle Braves legends
        if (teamKey === 'ATL') {
            teamRosters[teamKey + '_LEGENDS'] = {
                name: team.name + ' Legends',
                lineup: BRAVES_LEGENDS,
                abbr: 'ATL'
            };
            teamPitchers[teamKey + '_LEGENDS'] = BRAVES_LEGEND_PITCHERS;
        }

        teamRosters[teamKey] = {
            name: team.name,
            lineup: lineup,
            abbr: team.abbr
        };

        teamPitchers[teamKey] = pitchersList;

        return teamRosters[teamKey];

    } catch (error) {
        console.error(`Error fetching roster for ${team.name}:`, error);
        showErrorMessage(`Failed to load ${team.name} roster. Using backup data.`);
        return createBackupLineup(teamKey);
    }
}

// Fetch pitcher stats from MLB API
async function fetchPitcherStats(playerId, playerName) {
    try {
        const statsResponse = await fetch(
            `${MLB_API_BASE}/people/${playerId}/stats?stats=season&season=${CURRENT_SEASON}&group=pitching`
        );

        if (!statsResponse.ok) {
            throw new Error(`Failed to fetch stats for ${playerName}`);
        }

        const statsData = await statsResponse.json();
        const splits = statsData.stats?.[0]?.splits || [];

        if (splits.length === 0) {
            return {
                name: playerName,
                era: 4.00,
                whip: 1.30,
                k9: 8.0,
                control: 0.750,
                stuff: 0.750
            };
        }

        const statLine = splits[0].stat;
        const era = parseFloat(statLine.era) || 4.00;
        const whip = parseFloat(statLine.whip) || 1.30;
        const k9 = (statLine.strikeOuts / (statLine.inningsPitched || 1)) * 9;

        // Calculate control and stuff ratings
        const control = Math.max(0.5, 1.0 - (whip - 1.0) / 2);
        const stuff = Math.min(1.0, k9 / 12);

        return {
            name: playerName,
            era: era,
            whip: whip,
            k9: k9,
            control: control,
            stuff: stuff,
            realStats: statLine
        };

    } catch (error) {
        console.error(`Error fetching pitcher stats for ${playerName}:`, error);
        return {
            name: playerName,
            era: 4.00,
            whip: 1.30,
            k9: 8.0,
            control: 0.750,
            stuff: 0.750
        };
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
        const splits = statsData.stats?.[0]?.splits || [];

        if (splits.length === 0) {
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
        const avg = parseFloat(statLine.avg) || 0.250;
        const obp = parseFloat(statLine.obp) || 0.320;
        const slg = parseFloat(statLine.slg) || 0.400;

        const atBats = statLine.atBats || 400;
        const homeRuns = statLine.homeRuns || 10;
        const power = Math.min((homeRuns / atBats) * 2.5, 0.5);

        const stolenBases = statLine.stolenBases || 5;
        const speed = Math.min(0.4 + (stolenBases / 50), 1.0);

        const strikeOuts = statLine.strikeOuts || 80;
        const contact = Math.max(1.0 - (strikeOuts / atBats), 0.5);

        return {
            name: playerName,
            avg: avg,
            obp: obp,
            slg: slg,
            power: power,
            speed: speed,
            contact: contact,
            realStats: statLine
        };

    } catch (error) {
        console.error(`Error fetching stats for ${playerName}:`, error);
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

    const defaultPitchers = [];
    for (let i = 1; i <= 5; i++) {
        defaultPitchers.push({
            name: `${team.abbr} Pitcher ${i}`,
            era: 4.00,
            whip: 1.30,
            k9: 8.0,
            control: 0.750,
            stuff: 0.750
        });
    }

    teamPitchers[teamKey] = defaultPitchers;

    return {
        name: team.name,
        lineup: defaultLineup,
        abbr: team.abbr
    };
}

// Show loading/error messages
function showLoadingMessage(message) {
    const playLog = document.getElementById('playLog');
    if (playLog) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'play-item';
        loadingDiv.style.background = 'rgba(100, 100, 255, 0.3)';
        loadingDiv.textContent = message;
        loadingDiv.id = 'loading-message';

        const oldLoading = document.getElementById('loading-message');
        if (oldLoading) oldLoading.remove();

        playLog.insertBefore(loadingDiv, playLog.firstChild);
    }
}

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

    awaySelect.innerHTML += `<option value="ATL_LEGENDS">Atlanta Braves Legends</option>`;
    homeSelect.innerHTML += `<option value="ATL_LEGENDS">Atlanta Braves Legends</option>`;

    // Add event listeners to load pitchers when team is selected
    awaySelect.addEventListener('change', () => loadPitchers('away'));
    homeSelect.addEventListener('change', () => loadPitchers('home'));
}

// Load pitchers for selected team
async function loadPitchers(side) {
    const teamSelect = document.getElementById(side === 'away' ? 'awayTeam' : 'homeTeam');
    const pitcherSelect = document.getElementById(side === 'away' ? 'awayPitcher' : 'homePitcher');
    const teamKey = teamSelect.value;

    pitcherSelect.innerHTML = '<option value="">Loading...</option>';

    if (!teamKey) {
        pitcherSelect.innerHTML = '<option value="">Select team first</option>';
        return;
    }

    // Fetch roster if not cached
    if (!teamPitchers[teamKey]) {
        await fetchTeamRoster(teamKey);
    }

    const pitchers = teamPitchers[teamKey] || [];
    pitcherSelect.innerHTML = '';

    pitchers.forEach((pitcher, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${pitcher.name} (ERA: ${pitcher.era.toFixed(2)})`;
        pitcherSelect.appendChild(option);
    });

    if (pitchers.length > 0) {
        pitcherSelect.value = 0;
    }
}

// Start game
async function startGame() {
    const awayTeamKey = document.getElementById('awayTeam').value;
    const homeTeamKey = document.getElementById('homeTeam').value;
    const awayPitcherIndex = document.getElementById('awayPitcher').value;
    const homePitcherIndex = document.getElementById('homePitcher').value;

    if (!awayTeamKey || !homeTeamKey) {
        alert('Please select both teams!');
        return;
    }

    if (awayTeamKey === homeTeamKey) {
        alert('Please select different teams!');
        return;
    }

    if (awayPitcherIndex === '' || homePitcherIndex === '') {
        alert('Please select starting pitchers!');
        return;
    }

    const startBtn = document.getElementById('startBtn');
    startBtn.disabled = true;
    startBtn.textContent = 'Loading Teams...';

    gameState.loadingTeams = true;

    try {
        // Load teams
        if (awayTeamKey === 'ATL_LEGENDS') {
            if (!teamRosters['ATL'] && !teamRosters['ATL_LEGENDS']) {
                await fetchTeamRoster('ATL');
            }
            gameState.awayTeam = teamRosters['ATL_LEGENDS'];
            gameState.awayPitcher = teamPitchers['ATL_LEGENDS'][awayPitcherIndex];
        } else {
            if (!teamRosters[awayTeamKey]) {
                await fetchTeamRoster(awayTeamKey);
            }
            gameState.awayTeam = teamRosters[awayTeamKey];
            gameState.awayPitcher = teamPitchers[awayTeamKey][awayPitcherIndex];
        }

        if (homeTeamKey === 'ATL_LEGENDS') {
            if (!teamRosters['ATL'] && !teamRosters['ATL_LEGENDS']) {
                await fetchTeamRoster('ATL');
            }
            gameState.homeTeam = teamRosters['ATL_LEGENDS'];
            gameState.homePitcher = teamPitchers['ATL_LEGENDS'][homePitcherIndex];
        } else {
            if (!teamRosters[homeTeamKey]) {
                await fetchTeamRoster(homeTeamKey);
            }
            gameState.homeTeam = teamRosters[homeTeamKey];
            gameState.homePitcher = teamPitchers[homeTeamKey][homePitcherIndex];
        }

        gameState.awayTeam.key = awayTeamKey;
        gameState.homeTeam.key = homeTeamKey;

        const loadingMsg = document.getElementById('loading-message');
        if (loadingMsg) loadingMsg.remove();

        document.getElementById('teamSelection').style.display = 'none';
        document.getElementById('gameArea').style.display = 'block';
        document.getElementById('scoreboard').classList.add('active');

        updateDisplay();
        addPlayLog(`⚾ Game Start: ${gameState.awayTeam.name} @ ${gameState.homeTeam.name}`, true);
        addPlayLog(`Starting Pitchers: ${gameState.awayPitcher.name} vs ${gameState.homePitcher.name}`, true);

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
function simulateAtBat(batter, pitcher) {
    // Pitcher quality affects outcomes
    const pitcherQuality = 1.0 - ((pitcher.era - 3.5) / 10); // ERA around 3.5 is neutral
    const pitcherControl = pitcher.control;
    const pitcherStuff = pitcher.stuff;

    // Calculate probabilities
    const walkProb = (batter.obp - batter.avg) * (1.0 / pitcherControl);
    const strikeoutProb = (1 - batter.contact) * pitcherStuff * 0.30;
    const homerunProb = batter.power * (1.0 / pitcherStuff) * 0.30;
    const hitProb = batter.avg * pitcherQuality;

    const roll = Math.random();

    if (roll < walkProb) {
        return { type: 'walk', bases: 0 };
    } else if (roll < walkProb + strikeoutProb) {
        return { type: 'strikeout', bases: 0 };
    } else if (roll < walkProb + strikeoutProb + homerunProb) {
        return { type: 'homerun', bases: 4 };
    } else if (roll < walkProb + strikeoutProb + homerunProb + hitProb) {
        const hitRoll = Math.random();
        if (hitRoll < 0.05 + (batter.power * 0.1)) {
            return { type: 'triple', bases: 3 };
        } else if (hitRoll < 0.25 + (batter.power * 0.2)) {
            return { type: 'double', bases: 2 };
        } else {
            return { type: 'single', bases: 1 };
        }
    } else {
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

// Play animations
function playAnimation(type, message) {
    const container = document.getElementById('animationContainer');
    const overlay = document.createElement('div');
    overlay.className = 'animation-overlay';

    switch(type) {
        case 'strikeout':
            overlay.textContent = 'K!';
            overlay.className += ' strikeout-animation';
            overlay.style.color = '#ff3333';
            break;
        case 'homerun':
            overlay.textContent = '💥 HOME RUN! 💥';
            overlay.className += ' homerun-animation';
            overlay.style.color = '#ffeb3b';
            break;
        case 'walk':
            overlay.textContent = 'BB';
            overlay.className += ' walk-animation';
            overlay.style.color = '#4CAF50';
            break;
        case 'single':
        case 'double':
        case 'triple':
            overlay.textContent = message || 'HIT!';
            overlay.className += ' hit-animation';
            overlay.style.color = '#2196F3';
            break;
        case 'flyout':
            createBallFlight('flyout');
            return;
        case 'groundout':
            createBallFlight('groundout');
            return;
    }

    container.appendChild(overlay);
    setTimeout(() => overlay.remove(), 2000);
}

function createBallFlight(type) {
    const diamond = document.getElementById('diamond');
    const ball = document.createElement('div');
    ball.className = `ball-flight ball-${type}`;
    ball.style.left = '140px';
    ball.style.bottom = '30px';
    diamond.appendChild(ball);
    setTimeout(() => ball.remove(), 1500);
}

// Handle at-bat result
function handleAtBatResult(batter, result) {
    let runsScored = 0;
    let message = '';

    switch(result.type) {
        case 'walk':
            message = `${batter.name} walks.`;
            playAnimation('walk', message);
            runsScored = advanceRunners(1, false, batter.name);
            break;

        case 'strikeout':
            gameState.outs++;
            message = `${batter.name} strikes out. ${gameState.outs} out(s).`;
            playAnimation('strikeout', message);
            break;

        case 'single':
            message = `${batter.name} singles!`;
            playAnimation('single', message);
            if (gameState.topOfInning) gameState.awayHits++;
            else gameState.homeHits++;
            runsScored = advanceRunners(1, false, batter.name);
            break;

        case 'double':
            message = `${batter.name} doubles!`;
            playAnimation('double', '2B!');
            if (gameState.topOfInning) gameState.awayHits++;
            else gameState.homeHits++;
            runsScored = advanceRunners(2, false, batter.name);
            break;

        case 'triple':
            message = `${batter.name} triples!`;
            playAnimation('triple', '3B!');
            if (gameState.topOfInning) gameState.awayHits++;
            else gameState.homeHits++;
            runsScored = advanceRunners(3, false, batter.name);
            break;

        case 'homerun':
            message = `${batter.name} HITS A HOME RUN! 💥`;
            playAnimation('homerun', message);
            if (gameState.topOfInning) gameState.awayHits++;
            else gameState.homeHits++;
            runsScored = advanceRunners(4, false, batter.name);
            break;

        case 'groundout':
            gameState.outs++;
            message = `${batter.name} grounds out. ${gameState.outs} out(s).`;
            playAnimation('groundout', message);
            if (gameState.bases[0] && gameState.outs < 3) {
                runsScored = advanceRunners(1, true, '');
            }
            break;

        case 'flyout':
            gameState.outs++;
            message = `${batter.name} flies out. ${gameState.outs} out(s).`;
            playAnimation('flyout', message);
            if (gameState.bases[2] && gameState.outs < 3 && Math.random() > 0.3) {
                gameState.bases[2] = false;
                gameState.baseRunners[2] = '';
                runsScored = 1;
                message += ` ${gameState.baseRunners[2]} tags from third and scores!`;
            }
            break;

        case 'lineout':
            gameState.outs++;
            message = `${batter.name} lines out. ${gameState.outs} out(s).`;
            break;
    }

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

    if (gameState.outs >= 3) {
        endHalfInning();
    }
}

// Advance runners on base
function advanceRunners(bases, isOut, batterName) {
    let runsScored = 0;
    const newBases = [false, false, false];
    const newRunners = ['', '', ''];

    for (let i = 2; i >= 0; i--) {
        if (gameState.bases[i]) {
            const newPosition = i + bases;
            if (newPosition >= 3) {
                runsScored++;
            } else {
                newBases[newPosition] = true;
                newRunners[newPosition] = gameState.baseRunners[i];
            }
        }
    }

    if (!isOut && bases > 0 && bases < 4) {
        newBases[bases - 1] = true;
        newRunners[bases - 1] = batterName;
    } else if (bases === 4) {
        runsScored++;
    }

    gameState.bases = newBases;
    gameState.baseRunners = newRunners;
    updateRunnerDisplay();
    return runsScored;
}

// Update runner display on bases
function updateRunnerDisplay() {
    ['base1', 'base2', 'base3'].forEach((baseId, index) => {
        const base = document.getElementById(baseId);
        const existingRunner = base.querySelector('.runner');
        if (existingRunner) existingRunner.remove();

        if (gameState.bases[index]) {
            const runner = document.createElement('div');
            runner.className = 'runner';
            runner.textContent = '🏃';
            runner.title = gameState.baseRunners[index];
            base.appendChild(runner);
        }
    });
}

// End half inning
function endHalfInning() {
    const halfInning = gameState.topOfInning ? 'Top' : 'Bottom';
    addPlayLog(`End of ${halfInning} of inning ${gameState.inning}`, true);

    gameState.outs = 0;
    gameState.bases = [false, false, false];
    gameState.baseRunners = ['', '', ''];
    updateRunnerDisplay();

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
    const pitcher = gameState.topOfInning ? gameState.homePitcher : gameState.awayPitcher;
    const batter = battingTeam.lineup[gameState.currentBatterIndex];

    const result = simulateAtBat(batter, pitcher);
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
        setTimeout(playNext, 1200);
    }

    playNext();
}

// New game
function newGame() {
    gameState = {
        awayTeam: null,
        homeTeam: null,
        awayPitcher: null,
        homePitcher: null,
        inning: 1,
        topOfInning: true,
        outs: 0,
        balls: 0,
        strikes: 0,
        bases: [false, false, false],
        baseRunners: ['', '', ''],
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

    document.getElementById('playLog').innerHTML = '<h3>Play-by-Play</h3>';
    updateRunnerDisplay();
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
    const pitcher = gameState.topOfInning ? gameState.homePitcher : gameState.awayPitcher;
    const batter = battingTeam.lineup[gameState.currentBatterIndex];

    document.getElementById('currentBatter').innerHTML = `
        Now Batting: <strong>${batter.name}</strong>
        <div class="stats">AVG: ${batter.avg.toFixed(3)} | OBP: ${batter.obp.toFixed(3)} | SLG: ${batter.slg.toFixed(3)}</div>
    `;

    document.getElementById('currentPitcher').innerHTML = `
        Pitching: <strong>${pitcher.name}</strong>
        <div class="stats">ERA: ${pitcher.era.toFixed(2)} | WHIP: ${pitcher.whip.toFixed(2)} | K/9: ${pitcher.k9.toFixed(1)}</div>
    `;

    document.getElementById('countDisplay').textContent = `${gameState.outs} Out${gameState.outs !== 1 ? 's' : ''}`;
    updateRunnerDisplay();
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
