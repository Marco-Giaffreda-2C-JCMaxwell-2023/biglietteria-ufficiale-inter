const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database(path.join(__dirname, 'stadium.db'));

db.serialize(() => {
  // Users table - Aggiungi reset_token, reset_expires e telegram_chat_id
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      reset_token TEXT,
      reset_expires DATETIME,
      telegram_chat_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Errore creazione tabella users:', err);
    else {
      // Aggiungi colonne se non esistono (per upgrade)
      db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'", (err) => {});
      db.run("ALTER TABLE users ADD COLUMN reset_token TEXT", (err) => {});
      db.run("ALTER TABLE users ADD COLUMN reset_expires DATETIME", (err) => {});
      db.run("ALTER TABLE users ADD COLUMN telegram_chat_id TEXT", (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.log('⚠️ Errore aggiunta colonna telegram_chat_id:', err.message);
        } else if (!err) {
          console.log('✅ Colonna telegram_chat_id aggiunta con successo!');
        }
      });
    }
  });

  // Crea utente admin di default se non esiste
  db.get("SELECT id FROM users WHERE username = 'admin'", (err, row) => {
    if (!row) {
      bcrypt.hash('ronaldoilgot', 10, (err, hash) => {
        if (!err) {
          db.run("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'admin')", 
                 ['admin', 'marcogiaffreda06@gmail.com', hash]);
        }
      });
    }
  });

  // Events table
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date DATETIME NOT NULL,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      away_logo TEXT,
      competition TEXT DEFAULT 'Serie A',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seats table
  db.run(`
    CREATE TABLE IF NOT EXISTS seats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      seat_number TEXT NOT NULL,
      sector TEXT NOT NULL,
      row_number TEXT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      status TEXT DEFAULT 'available',
      locked_by INTEGER,
      locked_at DATETIME,
      booked_by INTEGER,
      booked_at DATETIME,
      FOREIGN KEY (event_id) REFERENCES events(id),
      FOREIGN KEY (locked_by) REFERENCES users(id),
      FOREIGN KEY (booked_by) REFERENCES users(id),
      UNIQUE(event_id, seat_number)
    )
  `);

  // Bookings table - senza UNIQUE su booking_code
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      seat_id INTEGER NOT NULL,
      booking_code TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'pending',
      total_amount DECIMAL(10,2) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (event_id) REFERENCES events(id),
      FOREIGN KEY (seat_id) REFERENCES seats(id)
    )
  `);

  // ELIMINA TUTTI I POSTI ESISTENTI
  db.run("DELETE FROM seats", (err) => {
    if (err) console.error("Errore cancellazione posti:", err);
    console.log("🗑️ Posti eliminati, verranno ricreati");
  });

  // CREA EVENTI (solo se non esistono)
  db.get("SELECT COUNT(*) as count FROM events", (err, row) => {
    if (err) return;
    
    if (row.count === 0) {
      const matches = [
        { date: '2025-08-25 20:45:00', opponent: 'Torino', logo: '/logos/torino.png' },
        { date: '2025-08-31 20:45:00', opponent: 'Udinese', logo: '/logos/udinese.png' },
        { date: '2025-09-21 15:00:00', opponent: 'Sassuolo', logo: '/logos/sassuolo.png' },
        { date: '2025-10-04 20:45:00', opponent: 'Cremonese', logo: '/logos/cremonese.png' },
        { date: '2025-10-29 20:45:00', opponent: 'Fiorentina', logo: '/logos/fiorentina.png' },
        { date: '2025-11-09 20:45:00', opponent: 'Lazio', logo: '/logos/lazio.png' },
        { date: '2025-11-23 20:45:00', opponent: 'Milan', logo: '/logos/milan.png' },
        { date: '2025-12-06 20:45:00', opponent: 'Como', logo: '/logos/como.png' },
        { date: '2026-01-04 20:45:00', opponent: 'Bologna', logo: '/logos/bologna.png' },
        { date: '2026-01-11 20:45:00', opponent: 'Napoli', logo: '/logos/napoli.png' },
        { date: '2026-01-14 20:45:00', opponent: 'Lecce', logo: '/logos/lecce.png' },
        { date: '2026-01-23 20:45:00', opponent: 'Pisa', logo: '/logos/pisa.png' },
        { date: '2026-02-14 20:45:00', opponent: 'Juventus', logo: '/logos/juventus.png' },
        { date: '2026-02-28 20:45:00', opponent: 'Genoa', logo: '/logos/genoa.png' },
        { date: '2026-03-15 15:00:00', opponent: 'Atalanta', logo: '/logos/atalanta.png' },
        { date: '2026-04-04 20:45:00', opponent: 'Roma', logo: '/logos/roma.png' },
        { date: '2026-04-19 15:00:00', opponent: 'Cagliari', logo: '/logos/cagliari.png' },
        { date: '2026-05-03 15:00:00', opponent: 'Parma', logo: '/logos/parma.png' },
        { date: '2026-05-17 15:00:00', opponent: 'Verona', logo: '/logos/verona.png' }
      ];
      
      matches.forEach((match) => {
        db.run(`
          INSERT INTO events (name, date, home_team, away_team, away_logo, competition)
          VALUES (?, ?, ?, ?, ?, 'Serie A')
        `, [`Inter vs ${match.opponent}`, match.date, 'Inter', match.opponent, match.logo]);
      });
      console.log(`✅ Creati ${matches.length} eventi`);
    }
  });

  // CREA POSTI per TUTTI gli eventi (anche quelli esistenti)
  setTimeout(() => {
    db.all("SELECT id FROM events", (err, events) => {
      if (err || !events || events.length === 0) {
        console.log("Nessun evento trovato");
        return;
      }
      
      const sectors = [
        { name: 'Curva Nord', prefix: 'TOC', rows: ['A','B','C','D','E','F'], price: 50, seatsPerRow: 15 },
        { name: 'Curva Sud', prefix: 'TOF', rows: ['A','B','C','D','E','F'], price: 65, seatsPerRow: 15 },
        { name: 'VIP Hospitality', prefix: 'TOG', rows: ['A','B','C','D'], price: 300, seatsPerRow: 10 },
        { name: 'Tribuna Ovest', prefix: 'PR', rows: ['A','B','C','D','E','F'], price: 100, seatsPerRow: 15 },
        { name: 'Tribuna Est', prefix: 'OS', rows: ['A','B','C','D','E'], price: 120, seatsPerRow: 15 },
        { name: 'Poltroncina Rossa (N-T)', prefix: 'NT', rows: ['A','B','C','D','E'], price: 250, seatsPerRow: 10 }
      ];

      let totalSeats = 0;
      
      events.forEach(event => {
        // Prima cancella i posti esistenti per questo evento
        db.run("DELETE FROM seats WHERE event_id = ?", [event.id]);
        
        const stmt = db.prepare(`
          INSERT INTO seats (event_id, seat_number, sector, row_number, price, status)
          VALUES (?, ?, ?, ?, ?, 'available')
        `);

        sectors.forEach(sector => {
          sector.rows.forEach(row => {
            for (let i = 1; i <= sector.seatsPerRow; i++) {
              const seatNumber = `${sector.prefix}${row}${i.toString().padStart(2, '0')}`;
              stmt.run(event.id, seatNumber, sector.name, row, sector.price);
              totalSeats++;
            }
          });
        });

        stmt.finalize();
      });
      
      console.log(`✅ Creati ${totalSeats} posti per ${events.length} eventi`);
      console.log(`📊 Posti per evento: ${totalSeats / events.length}`);
    });
  }, 500);
});

module.exports = db;