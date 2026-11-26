// Invented name pools per nationality. Combinations are random; no real players are intended.
import { pick, pickWeighted } from '../rng.js';

export const NAT_LABELS = {
  TR: 'Türkiye', NL: 'Hollanda', IT: 'İtalya', ES: 'İspanya', EN: 'İngiltere',
  NG: 'Nijerya', SN: 'Senegal', BR: 'Brezilya', AR: 'Arjantin', RS: 'Sırbistan', HR: 'Hırvatistan',
};

export const NAME_POOLS = {
  TR: {
    first: ['Emre', 'Burak', 'Can', 'Mert', 'Kerem', 'Arda', 'Onur', 'Eren', 'Yusuf', 'Ahmet', 'Mehmet', 'Murat', 'Serkan', 'Volkan', 'Berkay', 'Halil', 'Okan', 'Tolga', 'Barış', 'Cem', 'Deniz', 'Efe', 'Furkan', 'Gökhan', 'Hakan', 'İsmail', 'Kaan', 'Levent', 'Metin', 'Necati', 'Oğuz', 'Ozan', 'Selim', 'Taner', 'Uğur', 'Yasin', 'Alper', 'Batuhan', 'Cihan', 'Doruk', 'Ertuğrul', 'Ferhat', 'Güven', 'Hüseyin', 'Kağan', 'Orhan', 'Sinan', 'Tuncay'],
    last: ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Yıldız', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özdemir', 'Polat', 'Korkmaz', 'Erdem', 'Güneş', 'Aksoy', 'Tekin', 'Bulut', 'Acar', 'Uçar', 'Sönmez', 'Taş', 'Yavuz', 'Bayram', 'Akın', 'Coşkun', 'Duman', 'Eroğlu', 'Gül', 'Işık', 'Karaca', 'Ünal', 'Zengin', 'Toprak'],
  },
  NL: {
    first: ['Daan', 'Sem', 'Jesse', 'Lars', 'Bram', 'Thijs', 'Ruben', 'Niels', 'Joost', 'Stijn', 'Koen', 'Milan', 'Tim', 'Wouter', 'Jorrit', 'Sven', 'Rik', 'Pim', 'Gijs', 'Floris', 'Maarten', 'Teun', 'Dirk', 'Jelle'],
    last: ['de Vries', 'Jansen', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Boer', 'Mulder', 'Bos', 'Vos', 'Peeters', 'Hendriks', 'van Leeuwen', 'Dekker', 'Brouwer', 'de Groot', 'Kuipers', 'Schouten', 'Willems', 'Postma', 'Koster', 'Hoekstra', 'Verbeek', 'van den Berg'],
  },
  IT: {
    first: ['Matteo', 'Luca', 'Marco', 'Andrea', 'Davide', 'Simone', 'Federico', 'Nicolò', 'Riccardo', 'Gabriele', 'Alessio', 'Tommaso', 'Giorgio', 'Stefano', 'Fabio', 'Daniele', 'Emanuele', 'Paolo', 'Lorenzo', 'Edoardo', 'Enrico', 'Michele', 'Claudio', 'Vittorio'],
    last: ['Rossi', 'Ferrari', 'Russo', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Costa', 'Giordano', 'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Santoro', 'Mariani', 'Rinaldi', 'Caruso'],
  },
  ES: {
    first: ['Javier', 'Álvaro', 'Sergio', 'Pablo', 'Diego', 'Adrián', 'Iván', 'Rubén', 'Hugo', 'Mario', 'Óscar', 'Jorge', 'Dani', 'Marcos', 'Aitor', 'Unai', 'Borja', 'Ismael', 'Joan', 'Gonzalo', 'Enrique', 'Raimundo', 'Lucas', 'Fermín'],
    last: ['García', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Navarro', 'Torres', 'Domínguez', 'Gil', 'Vázquez', 'Serrano', 'Ortega', 'Delgado', 'Castro', 'Iglesias'],
  },
  EN: {
    first: ['Jack', 'Harry', 'Oliver', 'George', 'Charlie', 'Callum', 'Jordan', 'Ryan', 'Liam', 'Connor', 'Tom', 'Josh', 'Ben', 'Luke', 'Aaron', 'Dean', 'Kieran', 'Reece', 'Nathan', 'Mason', 'Ellis', 'Toby', 'Rhys', 'Archie'],
    last: ['Smith', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Walker', 'Hughes', 'Wright', 'Turner', 'Hill', 'Clarke', 'Cooper', 'Ward', 'Morris', 'Bailey', 'Parker', 'Cook', 'Bennett', 'Palmer', 'Fletcher', 'Holt', 'Marsh', 'Doyle', 'Pearce'],
  },
  NG: { first: ['Chidi', 'Emeka', 'Tunde', 'Obinna', 'Kelechi', 'Segun', 'Ikenna', 'Femi', 'Uche', 'Yakubu', 'Chukwu', 'Damilola'], last: ['Okafor', 'Adeyemi', 'Balogun', 'Eze', 'Nwosu', 'Olawale', 'Abubakar', 'Okonkwo', 'Ibrahim', 'Oyelaran', 'Danjuma', 'Obi'] },
  SN: { first: ['Mamadou', 'Ousmane', 'Cheikh', 'Idrissa', 'Moussa', 'Boubacar', 'Abdou', 'Lamine', 'Seydou', 'Ibou'], last: ['Diallo', 'Ndiaye', 'Sarr', 'Traoré', 'Koné', 'Camara', 'Fall', 'Diop', 'Gueye', 'Sow'] },
  BR: { first: ['Thiago', 'Rafael', 'Gustavo', 'Caio', 'Lucas', 'Felipe', 'Matheus', 'Rodrigo', 'Bruno', 'Diego', 'Renan', 'Leandro'], last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Lima', 'Costa', 'Ribeiro', 'Carvalho', 'Almeida', 'Barros', 'Teixeira'] },
  AR: { first: ['Matías', 'Nicolás', 'Facundo', 'Agustín', 'Gonzalo', 'Emiliano', 'Franco', 'Maximiliano', 'Tomás', 'Ezequiel'], last: ['Acosta', 'Benítez', 'Cabrera', 'Figueroa', 'Ledesma', 'Peralta', 'Sosa', 'Villalba', 'Molina', 'Paredes'] },
  RS: { first: ['Nemanja', 'Stefan', 'Luka', 'Dušan', 'Miloš', 'Filip', 'Vuk', 'Marko', 'Lazar', 'Uroš'], last: ['Jovanović', 'Petrović', 'Nikolić', 'Marković', 'Stojanović', 'Ilić', 'Kovačević', 'Pavlović', 'Savić', 'Tomić'] },
  HR: { first: ['Ivan', 'Marko', 'Josip', 'Tomislav', 'Dario', 'Luka', 'Ante', 'Mateo', 'Karlo', 'Petar'], last: ['Horvat', 'Kovač', 'Babić', 'Marić', 'Jurić', 'Perić', 'Knežević', 'Vuković', 'Radić', 'Tadić'] },
};

/** Nationality mix per league (weights). */
export const LEAGUE_NAT_MIX = {
  tr2: { TR: 88, NG: 2, SN: 2, BR: 2, RS: 3, HR: 2, AR: 1 },
  tr1: { TR: 70, NG: 4, SN: 3, BR: 6, RS: 5, HR: 3, AR: 3, NL: 1, EN: 1, ES: 1, IT: 1, },
  nl1: { NL: 58, BR: 6, NG: 4, SN: 4, RS: 4, HR: 3, TR: 6, EN: 4, ES: 3, IT: 3, AR: 2, },
  it1: { IT: 62, BR: 6, AR: 6, NG: 4, SN: 4, RS: 4, HR: 4, ES: 3, EN: 2, NL: 2, TR: 3, },
  es1: { ES: 60, BR: 8, AR: 8, NG: 3, SN: 3, RS: 3, HR: 3, IT: 3, EN: 3, NL: 2, TR: 4, },
  en1: { EN: 55, BR: 7, AR: 5, NG: 5, SN: 5, RS: 3, HR: 3, ES: 4, IT: 3, NL: 4, TR: 3, },
};

/** Generate a full name for the nationality. */
export function makeName(S, nat) {
  const pool = NAME_POOLS[nat] || NAME_POOLS.TR;
  return pick(S, pool.first) + ' ' + pick(S, pool.last);
}
/** Pick a nationality for a player of a league. */
export function pickNat(S, leagueId) { return pickWeighted(S, LEAGUE_NAT_MIX[leagueId]); }
