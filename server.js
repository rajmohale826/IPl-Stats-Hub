const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API Routes
app.get('/api/matches', async (req, res) => {
    try {
        const matches = await db.getRecentMatches();
        res.json(matches);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/match/:id', async (req, res) => {
    try {
        const matchDetails = await db.getMatchDetails(req.params.id);
        res.json(matchDetails);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/teams', async (req, res) => {
    try {
        const teams = await db.getAllTeams();
        res.json(teams);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/squad/:team', async (req, res) => {
    try {
        const squad = await db.getTeamSquad(req.params.team);
        res.json(squad);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/predict', async (req, res) => {
    try {
        const { team1, team2 } = req.body;
        const prediction = await db.predictMatch(team1, team2);
        res.json(prediction);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));