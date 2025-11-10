// MLB Teams and Player Data with Real Statistics
const MLB_TEAMS = {
    'LAD': {
        name: 'Los Angeles Dodgers',
        lineup: [
            { name: 'Mookie Betts', avg: 0.307, obp: 0.380, slg: 0.579, power: 0.280, speed: 0.850, contact: 0.820 },
            { name: 'Freddie Freeman', avg: 0.331, obp: 0.410, slg: 0.567, power: 0.250, speed: 0.600, contact: 0.880 },
            { name: 'Will Smith', avg: 0.261, obp: 0.360, slg: 0.462, power: 0.240, speed: 0.400, contact: 0.720 },
            { name: 'Max Muncy', avg: 0.212, obp: 0.360, slg: 0.480, power: 0.310, speed: 0.450, contact: 0.650 },
            { name: 'J.D. Martinez', avg: 0.271, obp: 0.321, slg: 0.479, power: 0.270, speed: 0.350, contact: 0.750 },
            { name: 'Chris Taylor', avg: 0.221, obp: 0.293, slg: 0.365, power: 0.180, speed: 0.700, contact: 0.680 },
            { name: 'Miguel Rojas', avg: 0.252, obp: 0.310, slg: 0.343, power: 0.080, speed: 0.650, contact: 0.780 },
            { name: 'James Outman', avg: 0.248, obp: 0.333, slg: 0.437, power: 0.220, speed: 0.750, contact: 0.670 },
            { name: 'Kiké Hernández', avg: 0.222, obp: 0.278, slg: 0.364, power: 0.150, speed: 0.700, contact: 0.710 }
        ]
    },
    'NYY': {
        name: 'New York Yankees',
        lineup: [
            { name: 'Aaron Judge', avg: 0.267, obp: 0.404, slg: 0.582, power: 0.380, speed: 0.600, contact: 0.730 },
            { name: 'Juan Soto', avg: 0.275, obp: 0.410, slg: 0.519, power: 0.310, speed: 0.550, contact: 0.800 },
            { name: 'Gleyber Torres', avg: 0.273, obp: 0.338, slg: 0.425, power: 0.200, speed: 0.600, contact: 0.760 },
            { name: 'Anthony Volpe', avg: 0.209, obp: 0.283, slg: 0.383, power: 0.180, speed: 0.820, contact: 0.650 },
            { name: 'Giancarlo Stanton', avg: 0.247, obp: 0.321, slg: 0.492, power: 0.340, speed: 0.350, contact: 0.650 },
            { name: 'Anthony Rizzo', avg: 0.243, obp: 0.340, slg: 0.341, power: 0.170, speed: 0.400, contact: 0.730 },
            { name: 'Alex Verdugo', avg: 0.233, obp: 0.291, slg: 0.356, power: 0.140, speed: 0.550, contact: 0.740 },
            { name: 'Jose Trevino', avg: 0.215, obp: 0.275, slg: 0.317, power: 0.100, speed: 0.400, contact: 0.710 },
            { name: 'Oswaldo Cabrera', avg: 0.247, obp: 0.296, slg: 0.365, power: 0.130, speed: 0.700, contact: 0.700 }
        ]
    },
    'ATL': {
        name: 'Atlanta Braves',
        lineup: [
            { name: 'Ronald Acuña Jr.', avg: 0.337, obp: 0.416, slg: 0.596, power: 0.330, speed: 0.950, contact: 0.850 },
            { name: 'Ozzie Albies', avg: 0.258, obp: 0.310, slg: 0.407, power: 0.200, speed: 0.800, contact: 0.770 },
            { name: 'Austin Riley', avg: 0.256, obp: 0.322, slg: 0.461, power: 0.280, speed: 0.500, contact: 0.720 },
            { name: 'Matt Olson', avg: 0.247, obp: 0.354, slg: 0.457, power: 0.310, speed: 0.450, contact: 0.700 },
            { name: 'Marcell Ozuna', avg: 0.274, obp: 0.337, slg: 0.489, power: 0.280, speed: 0.400, contact: 0.750 },
            { name: 'Sean Murphy', avg: 0.251, obp: 0.328, slg: 0.420, power: 0.210, speed: 0.450, contact: 0.730 },
            { name: 'Michael Harris II', avg: 0.296, obp: 0.340, slg: 0.479, power: 0.210, speed: 0.880, contact: 0.810 },
            { name: 'Orlando Arcia', avg: 0.251, obp: 0.319, slg: 0.434, power: 0.210, speed: 0.600, contact: 0.720 },
            { name: 'Eddie Rosario', avg: 0.255, obp: 0.305, slg: 0.408, power: 0.190, speed: 0.550, contact: 0.740 }
        ]
    },
    'HOU': {
        name: 'Houston Astros',
        lineup: [
            { name: 'Jose Altuve', avg: 0.341, obp: 0.407, slg: 0.547, power: 0.230, speed: 0.750, contact: 0.890 },
            { name: 'Yordan Alvarez', avg: 0.293, obp: 0.406, slg: 0.567, power: 0.360, speed: 0.400, contact: 0.820 },
            { name: 'Alex Bregman', avg: 0.260, obp: 0.365, slg: 0.453, power: 0.240, speed: 0.550, contact: 0.790 },
            { name: 'Kyle Tucker', avg: 0.289, obp: 0.379, slg: 0.544, power: 0.300, speed: 0.750, contact: 0.810 },
            { name: 'Jeremy Peña', avg: 0.267, obp: 0.315, slg: 0.419, power: 0.180, speed: 0.720, contact: 0.750 },
            { name: 'Yainer Diaz', avg: 0.299, obp: 0.340, slg: 0.463, power: 0.200, speed: 0.450, contact: 0.800 },
            { name: 'Chas McCormick', avg: 0.273, obp: 0.339, slg: 0.452, power: 0.200, speed: 0.700, contact: 0.760 },
            { name: 'Jose Abreu', avg: 0.237, obp: 0.296, slg: 0.368, power: 0.180, speed: 0.400, contact: 0.710 },
            { name: 'Mauricio Dubón', avg: 0.278, obp: 0.315, slg: 0.400, power: 0.130, speed: 0.750, contact: 0.790 }
        ]
    },
    'BAL': {
        name: 'Baltimore Orioles',
        lineup: [
            { name: 'Adley Rutschman', avg: 0.277, obp: 0.362, slg: 0.420, power: 0.210, speed: 0.500, contact: 0.800 },
            { name: 'Gunnar Henderson', avg: 0.275, obp: 0.362, slg: 0.489, power: 0.260, speed: 0.800, contact: 0.770 },
            { name: 'Anthony Santander', avg: 0.235, obp: 0.308, slg: 0.456, power: 0.280, speed: 0.500, contact: 0.690 },
            { name: 'Ryan Mountcastle', avg: 0.258, obp: 0.304, slg: 0.419, power: 0.240, speed: 0.500, contact: 0.730 },
            { name: 'Ryan O\'Hearn', avg: 0.263, obp: 0.329, slg: 0.440, power: 0.220, speed: 0.450, contact: 0.740 },
            { name: 'Cedric Mullins', avg: 0.233, obp: 0.303, slg: 0.388, power: 0.170, speed: 0.880, contact: 0.710 },
            { name: 'Jordan Westburg', avg: 0.264, obp: 0.311, slg: 0.460, power: 0.220, speed: 0.650, contact: 0.730 },
            { name: 'Colton Cowser', avg: 0.242, obp: 0.321, slg: 0.411, power: 0.190, speed: 0.700, contact: 0.710 },
            { name: 'Jorge Mateo', avg: 0.229, obp: 0.276, slg: 0.367, power: 0.140, speed: 0.900, contact: 0.680 }
        ]
    },
    'PHI': {
        name: 'Philadelphia Phillies',
        lineup: [
            { name: 'Trea Turner', avg: 0.266, obp: 0.319, slg: 0.425, power: 0.200, speed: 0.880, contact: 0.770 },
            { name: 'Bryce Harper', avg: 0.293, obp: 0.400, slg: 0.525, power: 0.310, speed: 0.600, contact: 0.810 },
            { name: 'Kyle Schwarber', avg: 0.197, obp: 0.339, slg: 0.445, power: 0.340, speed: 0.450, contact: 0.580 },
            { name: 'J.T. Realmuto', avg: 0.266, obp: 0.323, slg: 0.442, power: 0.220, speed: 0.650, contact: 0.760 },
            { name: 'Nick Castellanos', avg: 0.254, obp: 0.311, slg: 0.431, power: 0.230, speed: 0.500, contact: 0.740 },
            { name: 'Alec Bohm', avg: 0.280, obp: 0.332, slg: 0.411, power: 0.180, speed: 0.450, contact: 0.800 },
            { name: 'Bryson Stott', avg: 0.251, obp: 0.321, slg: 0.388, power: 0.150, speed: 0.700, contact: 0.750 },
            { name: 'Brandon Marsh', avg: 0.244, obp: 0.321, slg: 0.397, power: 0.170, speed: 0.750, contact: 0.710 },
            { name: 'Johan Rojas', avg: 0.235, obp: 0.272, slg: 0.337, power: 0.110, speed: 0.850, contact: 0.720 }
        ]
    },
    'SDP': {
        name: 'San Diego Padres',
        lineup: [
            { name: 'Fernando Tatis Jr.', avg: 0.282, obp: 0.354, slg: 0.500, power: 0.300, speed: 0.850, contact: 0.780 },
            { name: 'Manny Machado', avg: 0.278, obp: 0.353, slg: 0.466, power: 0.250, speed: 0.550, contact: 0.800 },
            { name: 'Xander Bogaerts', avg: 0.263, obp: 0.313, slg: 0.403, power: 0.170, speed: 0.550, contact: 0.790 },
            { name: 'Jake Cronenworth', avg: 0.242, obp: 0.322, slg: 0.398, power: 0.170, speed: 0.550, contact: 0.730 },
            { name: 'Juan Soto', avg: 0.242, obp: 0.388, slg: 0.404, power: 0.260, speed: 0.500, contact: 0.750 },
            { name: 'Ha-Seong Kim', avg: 0.260, obp: 0.351, slg: 0.398, power: 0.150, speed: 0.800, contact: 0.760 },
            { name: 'Luis Arraez', avg: 0.314, obp: 0.346, slg: 0.392, power: 0.070, speed: 0.550, contact: 0.920 },
            { name: 'Luis Campusano', avg: 0.263, obp: 0.316, slg: 0.435, power: 0.200, speed: 0.400, contact: 0.740 },
            { name: 'Jurickson Profar', avg: 0.243, obp: 0.331, slg: 0.391, power: 0.160, speed: 0.600, contact: 0.730 }
        ]
    },
    'TBR': {
        name: 'Tampa Bay Rays',
        lineup: [
            { name: 'Yandy Díaz', avg: 0.279, obp: 0.339, slg: 0.410, power: 0.170, speed: 0.500, contact: 0.810 },
            { name: 'Wander Franco', avg: 0.281, obp: 0.344, slg: 0.422, power: 0.180, speed: 0.750, contact: 0.820 },
            { name: 'Randy Arozarena', avg: 0.254, obp: 0.321, slg: 0.445, power: 0.240, speed: 0.820, contact: 0.720 },
            { name: 'Isaac Paredes', avg: 0.252, obp: 0.354, slg: 0.485, power: 0.280, speed: 0.400, contact: 0.710 },
            { name: 'Brandon Lowe', avg: 0.233, obp: 0.325, slg: 0.470, power: 0.290, speed: 0.550, contact: 0.670 },
            { name: 'Josh Lowe', avg: 0.244, obp: 0.321, slg: 0.421, power: 0.210, speed: 0.850, contact: 0.710 },
            { name: 'Taylor Walls', avg: 0.227, obp: 0.311, slg: 0.345, power: 0.110, speed: 0.650, contact: 0.710 },
            { name: 'Christian Bethancourt', avg: 0.230, obp: 0.276, slg: 0.391, power: 0.180, speed: 0.500, contact: 0.690 },
            { name: 'Jose Siri', avg: 0.201, obp: 0.271, slg: 0.366, power: 0.200, speed: 0.850, contact: 0.610 }
        ]
    }
};

// Game State
let gameState = {
    awayTeam: null,
    homeTeam: null,
    inning: 1,
    topOfInning: true,
    outs: 0,
    balls: 0,
    strikes: 0,
    bases: [false, false, false], // 1st, 2nd, 3rd
    awayScore: [0,0,0,0,0,0,0,0,0],
    homeScore: [0,0,0,0,0,0,0,0,0],
    awayHits: 0,
    homeHits: 0,
    awayErrors: 0,
    homeErrors: 0,
    currentBatterIndex: 0,
    playLog: [],
    isGameOver: false,
    autoPlaying: false
};

// Initialize team selects
function initTeamSelects() {
    const awaySelect = document.getElementById('awayTeam');
    const homeSelect = document.getElementById('homeTeam');

    for (let teamKey in MLB_TEAMS) {
        const team = MLB_TEAMS[teamKey];
        awaySelect.innerHTML += `<option value="${teamKey}">${team.name}</option>`;
        homeSelect.innerHTML += `<option value="${teamKey}">${team.name}</option>`;
    }
}

// Start game
function startGame() {
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

    gameState.awayTeam = { key: awayTeamKey, ...MLB_TEAMS[awayTeamKey] };
    gameState.homeTeam = { key: homeTeamKey, ...MLB_TEAMS[homeTeamKey] };

    document.getElementById('teamSelection').style.display = 'none';
    document.getElementById('gameArea').style.display = 'block';
    document.getElementById('scoreboard').classList.add('active');

    updateDisplay();
    addPlayLog(`⚾ Game Start: ${gameState.awayTeam.name} @ ${gameState.homeTeam.name}`, true);
}

// Simulate a single pitch and at-bat outcome
function simulateAtBat(batter) {
    const battingTeam = gameState.topOfInning ? gameState.awayTeam : gameState.homeTeam;
    const pitcher = gameState.topOfInning ? gameState.homeTeam : gameState.awayTeam;

    // Adjust for pitcher (simplified - using league average ERA ~4.00)
    const pitcherQuality = 0.95; // Slightly favors pitcher

    // Calculate probabilities based on batter stats
    const walkProb = batter.obp - batter.avg; // Isolated walks
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
            // Check for runners advancing on groundout
            if (gameState.bases[0] && gameState.outs < 3) {
                runsScored = advanceRunners(1, true);
            }
            break;

        case 'flyout':
            gameState.outs++;
            message = `${batter.name} flies out. ${gameState.outs} out(s).`;
            // Tag up from third with less than 2 outs
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
        // Home run - batter scores too
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
        // Check for game over
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
        // Add extra innings to score arrays if needed
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

    // Move to next batter
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
        autoPlaying: false
    };

    document.getElementById('teamSelection').style.display = 'block';
    document.getElementById('gameArea').style.display = 'none';
    document.getElementById('awayTeam').value = '';
    document.getElementById('homeTeam').value = '';
    document.getElementById('nextPlayBtn').disabled = false;
    document.getElementById('autoPlayBtn').disabled = false;
    document.getElementById('autoPlayBtn').textContent = 'Auto Play ▶';
}

// Update display
function updateDisplay() {
    if (!gameState.awayTeam || !gameState.homeTeam) return;

    // Update scoreboard
    updateScoreboard();

    // Update bases
    document.getElementById('base1').classList.toggle('occupied', gameState.bases[0]);
    document.getElementById('base2').classList.toggle('occupied', gameState.bases[1]);
    document.getElementById('base3').classList.toggle('occupied', gameState.bases[2]);

    // Update outs
    document.getElementById('out1').classList.toggle('active', gameState.outs >= 1);
    document.getElementById('out2').classList.toggle('active', gameState.outs >= 2);
    document.getElementById('out3').classList.toggle('active', gameState.outs >= 3);

    // Update inning
    const halfInning = gameState.topOfInning ? 'Top' : 'Bottom';
    document.getElementById('inningDisplay').textContent = `${halfInning} ${gameState.inning}`;

    // Update current batter
    const battingTeam = gameState.topOfInning ? gameState.awayTeam : gameState.homeTeam;
    const batter = battingTeam.lineup[gameState.currentBatterIndex];
    document.getElementById('currentBatter').innerHTML = `
        Now Batting: ${batter.name}
        <div class="stats">AVG: ${batter.avg.toFixed(3)} | OBP: ${batter.obp.toFixed(3)} | SLG: ${batter.slg.toFixed(3)}</div>
    `;

    // Update count display
    document.getElementById('countDisplay').textContent = `${gameState.outs} Out${gameState.outs !== 1 ? 's' : ''}`;
}

// Update scoreboard
function updateScoreboard() {
    const awayTotal = gameState.awayScore.reduce((a, b) => a + b, 0);
    const homeTotal = gameState.homeScore.reduce((a, b) => a + b, 0);

    // Away team row
    let awayHtml = `<div class="team-name">${gameState.awayTeam.name}</div>`;
    for (let i = 0; i < 9; i++) {
        awayHtml += `<div>${gameState.awayScore[i] || '-'}</div>`;
    }
    awayHtml += `<div style="font-weight: bold;">${awayTotal}</div>`;
    awayHtml += `<div>${gameState.awayHits}</div>`;
    awayHtml += `<div>${gameState.awayErrors}</div>`;
    document.getElementById('awayScore').innerHTML = awayHtml;

    // Home team row
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

    // Keep only last 50 plays
    while (playLogDiv.children.length > 50) {
        playLogDiv.removeChild(playLogDiv.lastChild);
    }
}

// Initialize on load
window.addEventListener('load', initTeamSelects);
