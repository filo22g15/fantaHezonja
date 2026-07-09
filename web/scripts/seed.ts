// Importa i dati attuali (data.js / bacheca.js nella root del repo) in league_state.
// Uso: npm run seed   (richiede env in web/.env.local con SERVICE_ROLE_KEY)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createAdminClient } from '../lib/supabase/admin';

function extractGlobal(file: string, varName: string) {
  const txt = readFileSync(file, 'utf8');
  const m = txt.match(new RegExp(`window\\.${varName}\\s*=\\s*([\\s\\S]*?);\\s*$`));
  if (!m) throw new Error(`Blocco window.${varName} non trovato in ${file}`);
  return JSON.parse(m[1]);
}

async function main() {
  const repoRoot = resolve(process.cwd(), '..'); // web/ -> root
  const data = extractGlobal(resolve(repoRoot, 'data.js'), 'LEAGUE');
  const bacheca = extractGlobal(resolve(repoRoot, 'bacheca.js'), 'BACHECA');

  console.log(
    `Import: ${data.teams?.length ?? 0} squadre, ${data.players?.length ?? 0} giocatori.`
  );

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('league_state')
    .upsert({ id: 1, data, bacheca, updated_at: new Date().toISOString() }, { onConflict: 'id' });

  if (error) {
    console.error('Errore upsert:', error.message);
    process.exit(1);
  }
  console.log('✓ league_state (id=1) aggiornato.');
}

main();
