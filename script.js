document.addEventListener('DOMContentLoaded', function() {
    // Load all teams for predictor and squads
    loadTeams();
    
    // Load recent matches
    loadMatches();
    
    // Setup event listeners
    document.getElementById('predictBtn').addEventListener('click', predictMatch);
    document.getElementById('teamSelect').addEventListener('change', loadSquad);
    document.getElementById('backToList').addEventListener('click', showMatchList);
});

async function loadTeams() {
    try {
        const response = await fetch('/api/teams');
        const teams = await response.json();
        
        // Populate predictor dropdowns
        const team1Select = document.getElementById('predictTeam1');
        const team2Select = document.getElementById('predictTeam2');
        const squadSelect = document.getElementById('teamSelect');
        
        teams.forEach(team => {
            const option = new Option(team.name, team.name);
            team1Select.add(new Option(team.name, team.name));
            team2Select.add(new Option(team.name, team.name));
            squadSelect.add(new Option(team.name, team.name));
        });
    } catch (error) {
        console.error('Error loading teams:', error);
    }
}

async function loadMatches() {
    try {
        const response = await fetch('/api/matches');
        const matches = await response.json();
        const matchList = document.getElementById('matchList');
        
        matchList.innerHTML = matches.map(match => `
            <div class="match-item" data-match-id="${match.id}">
                <div class="teams">${match.team1} vs ${match.team2}</div>
                <div class="result">${match.winner} won by ${match.result}</div>
                <div class="date">${new Date(match.date).toLocaleDateString()} • ${match.venue}</div>
                <div class="potm">Player of the Match: ${match.player_of_match}</div>
            </div>
        `).join('');
        
        // Add click event to match items
        document.querySelectorAll('.match-item').forEach(item => {
            item.addEventListener('click', function() {
                showMatchDetails(this.dataset.matchId);
            });
        });
    } catch (error) {
        console.error('Error loading matches:', error);
    }
}

async function showMatchDetails(matchId) {
    try {
        const response = await fetch(`/api/match/${matchId}`);
        const { match, batting, bowling } = await response.json();
        
        const detailsContent = document.getElementById('matchDetailsContent');
        detailsContent.innerHTML = `
            <h3>${match.team1} vs ${match.team2}</h3>
            <p class="match-info">
                <strong>Date:</strong> ${new Date(match.date).toLocaleDateString()} • 
                <strong>Venue:</strong> ${match.venue}
            </p>
            <p class="result"><strong>Result:</strong> ${match.winner} won by ${match.result}</p>
            <p class="potm"><strong>Player of the Match:</strong> ${match.player_of_match}</p>
            
            <div class="row mt-4">
                <div class="col-md-6">
                    <h4>Batting Performances</h4>
                    <div class="performance-list">
                        ${batting.map(player => `
                            <div class="player-performance">
                                <span>${player.player}</span>
                                <span>${player.runs} runs (${player.out ? 'out' : 'not out'})</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="col-md-6">
                    <h4>Bowling Performances</h4>
                    <div class="performance-list">
                        ${bowling.map(player => `
                            <div class="player-performance">
                                <span>${player.player}</span>
                                <span>${player.wickets}/${player.runs_given}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        // Show details and hide list
        document.getElementById('matchList').style.display = 'none';
        document.getElementById('matchDetails').style.display = 'block';
    } catch (error) {
        console.error('Error loading match details:', error);
    }
}

function showMatchList() {
    document.getElementById('matchList').style.display = 'block';
    document.getElementById('matchDetails').style.display = 'none';
}

async function predictMatch() {
    const team1 = document.getElementById('predictTeam1').value;
    const team2 = document.getElementById('predictTeam2').value;
    
    if (!team1 || !team2) {
        alert('Please select both teams');
        return;
    }
    
    try {
        const response = await fetch('/api/predict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ team1, team2 })
        });
        
        const prediction = await response.json();
        
        // Display prediction results
        document.getElementById('team1Name').textContent = team1;
        document.getElementById('team2Name').textContent = team2;
        
        document.getElementById('team1Prob').textContent = `${prediction.team1WinProb.toFixed(1)}% win chance`;
        document.getElementById('team2Prob').textContent = `${prediction.team2WinProb.toFixed(1)}% win chance`;
        
        document.getElementById('team1Score').textContent = `Predicted Total: ${prediction.team1Total}`;
        document.getElementById('team2Score').textContent = `Predicted Total: ${prediction.team2Total}`;
        
        document.getElementById('team1Players').innerHTML = prediction.team1Players.map(player => `
            <div class="player-prediction">
                <span>${player.player}</span>
                <span class="predicted-runs">~${player.runs} runs</span>
            </div>
        `).join('');
        
        document.getElementById('team2Players').innerHTML = prediction.team2Players.map(player => `
            <div class="player-prediction">
                <span>${player.player}</span>
                <span class="predicted-runs">~${player.runs} runs</span>
            </div>
        `).join('');
        
        document.getElementById('winnerPrediction').textContent = 
            `Predicted Winner: ${prediction.predictedWinner}`;
        
        document.getElementById('predictionResult').style.display = 'block';
    } catch (error) {
        console.error('Error predicting match:', error);
        alert('Error generating prediction. Please try again.');
    }
}

async function loadSquad() {
    const team = document.getElementById('teamSelect').value;
    if (!team) return;
    
    try {
        const response = await fetch(`/api/squad/${team}`);
        const squad = await response.json();
        
        const squadContainer = document.getElementById('squadContainer');
        squadContainer.innerHTML = squad.map(player => `
            <div class="col-md-4 mb-3">
                <div class="player-card">
                    <img src="${player.image}" 
                         alt="${player.name}"
                         onerror="this.src='/images/players/default.jpg'">
                    <div class="player-info">
                        <h5>${player.name}</h5>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading squad:', error);
    }
}