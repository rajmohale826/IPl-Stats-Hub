const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'ipl2',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = {
    getRecentMatches: async () => {
        const [matches] = await pool.query(`
            SELECT id, team1, team2, winner, result, date, venue, player_of_match 
            FROM matches 
            WHERE season = 2024
            ORDER BY date DESC 
            LIMIT 50
        `);
        return matches;
    },

    getMatchDetails: async (matchId) => {
        // Get match info
        const [[match]] = await pool.query(`
            SELECT * FROM matches WHERE id = ?
        `, [matchId]);

        // Get batting performances
        const [batting] = await pool.query(`
            SELECT batter AS player, SUM(batsman_runs) AS runs, 
                   COUNT(CASE WHEN is_wicket = 1 AND player_dismissed = batter THEN 1 END) AS out
            FROM deliveries 
            WHERE match_id = ?
            GROUP BY batter
            ORDER BY runs DESC
            LIMIT 11
        `, [matchId]);

        // Get bowling performances
        const [bowling] = await pool.query(`
            SELECT bowler AS player, 
                   SUM(CASE WHEN is_wicket = 1 THEN 1 ELSE 0 END) AS wickets,
                   SUM(total_runs) AS runs_given
            FROM deliveries 
            WHERE match_id = ?
            GROUP BY bowler
            ORDER BY wickets DESC
            LIMIT 11
        `, [matchId]);

        return { match, batting, bowling };
    },

    getAllTeams: async () => {
        const [teams] = await pool.query(`
            SELECT DISTINCT team1 AS name FROM matches WHERE season = 2024
            UNION
            SELECT DISTINCT team2 AS name FROM matches WHERE season = 2024
            ORDER BY name
        `);
        return teams;
    },

    getTeamSquad: async (team) => {
        // Get top 11 players who batted most in 2024 for this team
        const [players] = await pool.query(`
            SELECT d.batter AS name
            FROM deliveries d
            JOIN matches m ON d.match_id = m.id
            WHERE d.batting_team = ? AND m.season = 2024
            GROUP BY d.batter
            ORDER BY COUNT(*) DESC
            LIMIT 11
        `, [team]);
        return players;
    },

    predictMatch: async (team1, team2) => {
        try {
            // 1. Get team players with averages
            const getTeamPlayers = async (team) => {
                const [players] = await pool.query(`
                    SELECT 
                        batter AS player,
                        ROUND(SUM(batsman_runs)/GREATEST(COUNT(DISTINCT match_id), 1), 1) AS avg_runs,
                        COUNT(DISTINCT match_id) AS matches_played
                    FROM deliveries
                    WHERE batting_team = ?
                    GROUP BY batter
                    HAVING COUNT(DISTINCT match_id) >= 3
                    ORDER BY avg_runs DESC
                    LIMIT 7
                `, [team]);
                
                // Fallback if no players found
                return players.length > 0 ? players : [
                    { player: `${team} Batsman 1`, avg_runs: 35, matches_played: 10 },
                    { player: `${team} Batsman 2`, avg_runs: 30, matches_played: 8 },
                    { player: `${team} Batsman 3`, avg_runs: 25, matches_played: 7 },
                    { player: `${team} All-Rounder`, avg_runs: 20, matches_played: 5 },
                    { player: `${team} Wicketkeeper`, avg_runs: 28, matches_played: 6 },
                    { player: `${team} Bowler 1`, avg_runs: 12, matches_played: 4 },
                    { player: `${team} Bowler 2`, avg_runs: 10, matches_played: 4 }
                ];
            };
    
            const [team1Players, team2Players] = await Promise.all([
                getTeamPlayers(team1),
                getTeamPlayers(team2)
            ]);
    
            // 2. Realistic score prediction
            const predictInnings = (players) => {
                const results = [];
                let total = 0;
                
                // Top order (positions 1-3) - score most runs
                for (let i = 0; i < 3 && i < players.length; i++) {
                    const base = players[i].avg_runs;
                    const runs = Math.round(base * (0.8 + Math.random() * 0.4)); // 80-120% of average
                    results.push({
                        player: players[i].player,
                        runs: runs,
                        type: 'top-order'
                    });
                    total += runs;
                }
                
                // Middle order (positions 4-5) - moderate scores
                for (let i = 3; i < 5 && i < players.length; i++) {
                    const base = players[i].avg_runs;
                    const runs = Math.round(base * (0.6 + Math.random() * 0.3)); // 60-90% of average
                    results.push({
                        player: players[i].player,
                        runs: runs,
                        type: 'middle-order'
                    });
                    total += runs;
                }
                
                // Tailenders (positions 6-7) - minimal contributions
                for (let i = 5; i < 7 && i < players.length; i++) {
                    const base = players[i].avg_runs;
                    const runs = Math.round(base * (0.3 + Math.random() * 0.3)); // 30-60% of average
                    results.push({
                        player: players[i].player,
                        runs: runs,
                        type: 'tailender'
                    });
                    total += runs;
                }
                
                // Ensure realistic T20 total (120-200)
                return {
                    players: results,
                    total: Math.min(200, Math.max(120, total))
                };
            };
    
            const team1Innings = predictInnings(team1Players);
            const team2Innings = predictInnings(team2Players);
    
            // 3. Calculate win probability PURELY based on predicted runs
            const calculateWinProbability = (runs1, runs2) => {
                const difference = runs1 - runs2;
                let probability = 50 + (difference * 0.5); // 1% per 2-run difference
                
                // Cap between 10% and 90%
                return Math.max(10, Math.min(90, Math.round(probability)));
            };
    
            const team1WinProb = calculateWinProbability(team1Innings.total, team2Innings.total);
    
            return {
                team1,
                team2,
                team1Total: team1Innings.total,
                team2Total: team2Innings.total,
                team1WinProb,
                team2WinProb: 100 - team1WinProb,
                predictedWinner: team1Innings.total > team2Innings.total ? team1 : team2,
                team1Players: team1Innings.players
                    .sort((a,b) => b.runs - a.runs)
                    .slice(0, 5),
                team2Players: team2Innings.players
                    .sort((a,b) => b.runs - a.runs)
                    .slice(0, 5)
            };
    
        } catch (error) {
            console.error('Prediction error:', error);
            throw new Error('Failed to generate prediction. Please try again.');
        }
    }
};