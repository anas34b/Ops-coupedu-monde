// Job Mission 3 — Rapport quotidien : classement des groupes + résultats des votes.
// Lit la même base PostgreSQL que l'app (read-only), reproduit la logique de
// classement de /api/standings et /api/votes/results, et dépose le rapport sur S3.
//
// Variables d'environnement attendues :
//   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME  (mêmes que l'app, via le Secret K8s)
//   S3_BUCKET                                        (bucket de destination)
//   AWS_REGION                                       (région du bucket, défaut eu-west-3)

const { Pool } = require('pg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'worldcup2026',
});

async function computeStandings() {
  const matchesResult = await pool.query(`
    SELECT team_home_id, team_away_id, score_home, score_away
    FROM matches
    WHERE stage = 'Group Stage'
  `);
  const teamsResult = await pool.query(
    'SELECT id, name, group_letter, country_code FROM teams ORDER BY group_letter, name'
  );

  const standings = {};
  for (const team of teamsResult.rows) {
    standings[team.id] = {
      id: team.id,
      name: team.name,
      group_letter: team.group_letter,
      country_code: team.country_code,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goals_for: 0,
      goals_against: 0,
      goal_difference: 0,
      points: 0,
    };
  }

  for (const match of matchesResult.rows) {
    const home = standings[match.team_home_id];
    const away = standings[match.team_away_id];
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.goals_for += match.score_home;
    home.goals_against += match.score_away;
    away.goals_for += match.score_away;
    away.goals_against += match.score_home;

    if (match.score_home > match.score_away) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (match.score_home < match.score_away) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points += 1;
      away.points += 1;
    }
  }

  const groups = {};
  for (const team of Object.values(standings)) {
    team.goal_difference = team.goals_for - team.goals_against;
    if (!groups[team.group_letter]) groups[team.group_letter] = [];
    groups[team.group_letter].push(team);
  }

  for (const group of Object.keys(groups)) {
    groups[group].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
      return b.goals_for - a.goals_for;
    });
  }

  return groups;
}

async function computeVoteResults() {
  const result = await pool.query(`
    SELECT t.id AS team_id, t.name AS team_name, COUNT(v.id) AS votes
    FROM votes v
    JOIN teams t ON t.id = v.team_id
    GROUP BY t.id, t.name
    ORDER BY votes DESC
  `);

  if (result.rows.length === 0) return [];

  const totalVotes = result.rows.reduce((sum, row) => sum + parseInt(row.votes, 10), 0);

  return result.rows.map((row) => ({
    team_id: row.team_id,
    team_name: row.team_name,
    votes: parseInt(row.votes, 10),
    percentage: parseFloat(((parseInt(row.votes, 10) / totalVotes) * 100).toFixed(2)),
  }));
}

async function main() {
  const date = new Date().toISOString().slice(0, 10);

  console.log(`[job] Démarrage du rapport quotidien pour ${date}`);

  const [standings, voteResults] = await Promise.all([computeStandings(), computeVoteResults()]);

  const report = {
    generated_at: new Date().toISOString(),
    standings,
    vote_results: voteResults,
  };

  const body = JSON.stringify(report, null, 2);
  const key = `reports/classement-${date}.json`;

  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    console.log('[job] S3_BUCKET non défini — rapport affiché en sortie standard uniquement.');
    console.log(body);
  } else {
    const s3 = new S3Client({ region: process.env.AWS_REGION || 'eu-west-3' });
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: 'application/json',
      })
    );
    console.log(`[job] Rapport déposé sur s3://${bucket}/${key}`);
  }

  await pool.end();
}

main().catch((error) => {
  console.error('[job] Échec du job :', error);
  process.exitCode = 1;
});
