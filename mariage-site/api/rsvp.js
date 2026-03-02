const { google } = require('googleapis');

const SPREADSHEET_ID = '1f2FXLK2Lfa8b5bpCrN7iM-Vy36scAT1KWyBpr7RtLAg';

function getAuth() {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const data = req.body;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

    const typeTab = data.type || 'Cocktail';
    const validTabs = ['Cocktail', 'Dîner', 'Brunch'];
    const targetTab = validTabs.includes(typeTab) ? typeTab : 'Cocktail';

    const persons = data.persons || [];
    const rows = persons.map((p, i) => [
      now,
      data.type || '',
      p.nom || '',
      p.prenom || '',
      p.cocktail || '',
      p.diner || '',
      p.brunch || '',
      p.intolerances || '',
      i === 0 ? (data.messe_participation || 'Non répondu') : '',
      i === 0 ? (data.messe_detail || '') : '',
    ]);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Aucune personne renseignée' });
    }

    // Append to specific tab
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${targetTab}'!A:J`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    });

    // Append to "Toutes les réponses"
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Toutes les réponses'!A:J",
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('RSVP API error:', err);
    return res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
};
