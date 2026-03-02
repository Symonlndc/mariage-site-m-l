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

    // Update Dashboard
    await updateDashboard(sheets);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('RSVP API error:', err);
    return res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
};

async function updateDashboard(sheets) {
  try {
    // Count rows in each tab (minus header)
    const tabs = ['Cocktail', 'Dîner', 'Brunch'];
    const counts = {};
    const presents = {};

    for (const tab of tabs) {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${tab}'!A:Q`,
      });
      const rows = resp.data.values || [];
      const dataRows = rows.slice(1); // skip header
      counts[tab] = dataRows.length;

      // Count presents: check the relevant column for "Oui"
      // Cocktail=col F(5), Dîner=col G(6), Brunch=col H(7)
      const colIdx = tab === 'Cocktail' ? 5 : tab === 'Dîner' ? 6 : 7;
      let presentCount = 0;
      for (const r of dataRows) {
        // Count P1
        if (r[colIdx] === 'Oui') presentCount++;
        // Count P2 if not alone
        if (r[2] === 'Non' && r[colIdx + 6] === 'Oui') presentCount++;
      }
      presents[tab] = presentCount;
    }

    // Total persons
    const allResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Toutes les réponses'!A:C",
    });
    const allRows = (allResp.data.values || []).slice(1);
    let totalPersons = 0;
    for (const r of allRows) {
      totalPersons += 1; // P1
      if (r[2] === 'Non') totalPersons += 1; // P2 if not alone
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Dashboard'!A3",
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          ['', 'Total réponses', 'Présents'],
          ['Cocktail', String(counts['Cocktail'] || 0), String(presents['Cocktail'] || 0)],
          ['Dîner', String(counts['Dîner'] || 0), String(presents['Dîner'] || 0)],
          ['Brunch', String(counts['Brunch'] || 0), String(presents['Brunch'] || 0)],
          ['', '', ''],
          ['Total personnes (P1+P2)', String(totalPersons), ''],
        ],
      },
    });
  } catch (e) {
    console.error('Dashboard update error:', e.message);
  }
}
