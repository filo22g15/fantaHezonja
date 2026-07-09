// Test rapido dello scraper (valida il parsing, non l'anti-bot su Vercel).
import { syncPlayer } from '../lib/scrape';

const name = process.argv[2] || 'LeBron James';
const seasons = ['2025/26', '2026/27', '2027/28', '2028/29', '2029/30'];

syncPlayer(name, seasons).then((res) => {
  console.log('Giocatore:', name);
  console.log('Ruolo:', res.role);
  console.log('Contratto per stagione:', res.sal);
  console.log('Trovato qualcosa:', res.found);
});
