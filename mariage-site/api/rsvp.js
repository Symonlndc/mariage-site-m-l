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
  // CORS
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

    const row = [
      now,
      data.type || '',
      data.alone ? 'Oui' : 'Non',
      data.p1_nom || '',
      data.p1_prenom || '',
      data.p1_cocktail || '',
      data.p1_diner || '',
      data.p1_brunch || '',
      data.p1_intolerances || '',
      data.p2_nom || '',
      data.p2_prenom || '',
      data.p2_cocktail || '',
      data.p2_diner || '',
      data.p2_brunch || '',
      data.p2_intolerances || '',
      data.messe_participation || 'Non répondu',
      data.messe_detail || '',
    ];

    // Determine which tab based on type
    const typeTab = data.type || 'Cocktail';
    const validTabs = ['Cocktail', 'Dîner', 'Brunch'];
    const targetTab = validTabs.includes(typeTab) ? typeTab : 'Cocktail';

    // Append to specific tab
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${targetTab}'!A:Q`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    // Append to "Toutes les réponses"
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Toutes les réponses'!A:Q",
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('RSVP API error:', err);
    return res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
};

