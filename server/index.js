const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// ============ NODEMAILER PER EMAIL ============
const nodemailer = require('nodemailer');

// ============ PER GENERARE PDF CON PUPPETEER ============
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

// ============ AGGIUNTA PER TELEGRAM ============
const TelegramBot = require('node-telegram-bot-api');
// ===============================================

const db = require('./database');

// Cartella temporanea per i PDF
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ============ CONFIGURAZIONE NODEMAILER ============
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'marcogiaffreda06@gmail.com',     
        pass: 'vhcbijrfsbgfmjgm'            
    },
    tls: {
        rejectUnauthorized: false
    },
    family: 4  // FORZA IPv4
});

// Funzione per inviare email
async function sendEmail(to, subject, html, attachments = []) {
    try {
        await transporter.sendMail({
            from: `"Biglietteria Ufficiale Inter" <${process.env.EMAIL_USER || 'noreply@stadiomeazza.it'}>`,
            to: to,
            subject: subject,
            html: html,
            attachments: attachments
        });
        console.log(`✅ Email inviata a ${to}`);
        return true;
    } catch (error) {
        console.error('❌ Errore invio email:', error);
        return false;
    }
}

// Funzione per generare token reset
const crypto = require('crypto');
function generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ============ MAPPA DEI LOGHI DELLE SQUADRE ============
const teamLogos = {
    'juventus': 'https://upload.wikimedia.org/wikipedia/commons/e/ed/Juventus_FC_-_logo_black_%28Italy%2C_2020%29.svg',
    'milan': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Logo_of_AC_Milan.svg/500px-Logo_of_AC_Milan.svg.png',
    'roma': 'https://upload.wikimedia.org/wikipedia/it/thumb/0/0e/AS_Roma_Logo_2017.svg/500px-AS_Roma_Logo_2017.svg.png',
    'napoli': 'https://upload.wikimedia.org/wikipedia/commons/4/4d/SSC_Napoli_2025_%28white_and_azure%29.svg',
    'lazio': 'https://upload.wikimedia.org/wikipedia/it/thumb/6/62/Stemma_della_Societ%C3%A0_Sportiva_Lazio.svg/960px-Stemma_della_Societ%C3%A0_Sportiva_Lazio.svg.png',
    'fiorentina': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/ACF_Fiorentina.svg/500px-ACF_Fiorentina.svg.png',
    'atalanta': 'https://upload.wikimedia.org/wikipedia/it/archive/8/81/20190126005333%21Logo_Atalanta_Bergamo.svg',
    'torino': 'https://upload.wikimedia.org/wikipedia/it/thumb/0/04/Torino_FC_logo.svg/500px-Torino_FC_logo.svg.png',
    'bologna': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Bologna_F.C._1909_logo.svg/250px-Bologna_F.C._1909_logo.svg.png',
    'udinese': 'https://upload.wikimedia.org/wikipedia/it/thumb/a/ae/Logo_Udinese_Calcio_2010.svg/960px-Logo_Udinese_Calcio_2010.svg.png',
    'sassuolo': 'https://upload.wikimedia.org/wikipedia/it/thumb/a/a4/Ussassuolostemma.svg/960px-Ussassuolostemma.svg.png',
    'genoa': 'https://upload.wikimedia.org/wikipedia/it/thumb/9/99/Genoa_Cricket_and_Football_Club_logo.svg/250px-Genoa_Cricket_and_Football_Club_logo.svg.png',
    'verona': 'https://upload.wikimedia.org/wikipedia/it/thumb/9/92/Hellas_Verona_FC_logo_%282020%29.svg/250px-Hellas_Verona_FC_logo_%282020%29.svg.png',
    'cagliari': 'https://upload.wikimedia.org/wikipedia/it/thumb/8/88/Cagliari_calcio.svg/250px-Cagliari_calcio.svg.png',
    'parma': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Logo_Parma_Calcio_1913_%28adozione_2016%29.svg/250px-Logo_Parma_Calcio_1913_%28adozione_2016%29.svg.png',
    'como': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Calcio_Como_-_logo_%28Italy%2C_2019-%29.svg/250px-Calcio_Como_-_logo_%28Italy%2C_2019-%29.svg.png',
    'lecce': 'https://upload.wikimedia.org/wikipedia/it/thumb/3/36/US_Lecce_Stemma.svg/250px-US_Lecce_Stemma.svg.png',
    'pisa': 'https://upload.wikimedia.org/wikipedia/it/thumb/3/36/US_Lecce_Stemma.svg/250px-US_Lecce_Stemma.svg.png',
    'cremonese': 'https://upload.wikimedia.org/wikipedia/it/thumb/2/23/Unione_Sportiva_Cremonese_logo.svg/330px-Unione_Sportiva_Cremonese_logo.svg.png',
    'inter': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/FC_Internazionale_Milano_2021.svg/120px-FC_Internazionale_Milano_2021.svg.png'
};

function getTeamLogo(teamName) {
    const key = teamName.toLowerCase().replace(/\s/g, '');
    return teamLogos[key] || teamLogos['inter'];
}
// ===================================================

// ============ FUNZIONI PER GENERARE PDF ============
function generateTicketHTML(bookingData, seat, index, ticketHolder) {
    const eventParts = bookingData.event.split(' vs ');
    const awayTeam = eventParts[1] || 'Opponent';
    const interLogo = getTeamLogo('inter');
    const awayTeamLogo = getTeamLogo(awayTeam);
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Biglietto - ${bookingData.bookingCode}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: 'DM Sans', 'Arial', sans-serif;
                background: white;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                padding: 20px;
            }
            .ticket-card {
                max-width: 600px;
                width: 100%;
                background: white;
                border: 1px solid #e0e0e0;
                border-radius: 24px;
                padding: 40px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            }
            .logo {
                text-align: center;
                margin-bottom: 20px;
            }
            .logo img {
                width: 80px;
            }
            h1 {
                font-size: 24px;
                color: #0c0d10;
                text-align: center;
                margin-bottom: 10px;
            }
            .booking-code {
                background: #f5f5f5;
                padding: 15px;
                border-radius: 12px;
                text-align: center;
                margin: 20px 0;
            }
            .booking-code strong {
                color: #c8a97e;
                font-size: 16px;
            }
            .teams {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 30px;
                margin: 25px 0;
            }
            .team {
                text-align: center;
                flex: 1;
            }
            .team img {
                width: 70px;
                height: 70px;
                object-fit: contain;
                margin-bottom: 8px;
            }
            .team span {
                font-size: 14px;
                font-weight: bold;
                display: block;
            }
            .vs {
                font-size: 24px;
                font-weight: bold;
                color: #c8a97e;
            }
            .holder-info {
                background: #e8f5e9;
                padding: 12px;
                border-radius: 12px;
                text-align: center;
                margin: 15px 0;
                border: 1px solid #4caf50;
            }
            .holder-info strong {
                color: #2e7d32;
            }
            .details {
                margin: 20px 0;
                border-top: 1px solid #e0e0e0;
                padding-top: 20px;
            }
            .details p {
                margin: 8px 0;
                font-size: 14px;
                color: #333;
            }
            .details strong {
                color: #0c0d10;
            }
            .seat-box {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 12px;
                margin: 15px 0;
            }
            .totals {
                border-top: 2px solid #e0e0e0;
                padding-top: 15px;
                margin-top: 15px;
            }
            .footer {
                text-align: center;
                font-size: 11px;
                color: #999;
                margin-top: 25px;
                padding-top: 15px;
                border-top: 1px solid #e0e0e0;
            }
        </style>
    </head>
    <body>
        <div class="ticket-card">
            <div class="logo">
                <img src="${interLogo}" alt="Inter Milan">
            </div>
            
            <h1>Prenotazione Confermata!</h1>
            <p style="text-align: center; font-size: 13px;">I tuoi biglietti sono stati prenotati con successo.</p>
            
            <div class="booking-code">
                <strong>Codice Prenotazione:</strong> ${bookingData.bookingCode}
            </div>
            
            <div class="teams">
                <div class="team">
                    <img src="${interLogo}" alt="Inter">
                    <span>INTER</span>
                </div>
                <div class="vs">VS</div>
                <div class="team">
                    <img src="${awayTeamLogo}" alt="${awayTeam}">
                    <span>${awayTeam.toUpperCase()}</span>
                </div>
            </div>
            
            <div class="holder-info">
                <strong>👤 Intestatario biglietto:</strong> ${ticketHolder.fullName || 'Non specificato'}
            </div>
            
            <div class="details">
                <p><strong>Partita:</strong> ${bookingData.event}</p>
                <p><strong>Data:</strong> ${bookingData.date}</p>
                <p><strong>Orario:</strong> ${bookingData.time || '20:45'}</p>
                <p><strong>Stadio:</strong> Giuseppe Meazza</p>
                <p><strong>Metodo di pagamento:</strong> ${bookingData.paymentMethod === 'credit_card' ? 'Carta di credito' : 'PayPal'}</p>
            </div>
            
            <div class="seat-box">
                <p><strong>Posto:</strong> ${seat.seat_number}</p>
                <p><strong>Settore:</strong> ${seat.sector}</p>
                <p><strong>Prezzo:</strong> €${seat.price}</p>
            </div>
            
            <div class="totals">
                ${bookingData.discountApplied && bookingData.discountAmount > 0 ? `
                    <p><strong>Totale originale:</strong> €${bookingData.originalTotal}</p>
                    <p><strong>Totale pagato:</strong> €${bookingData.totalAmount}</p>
                    <p><strong>Sconto applicato:</strong> ${bookingData.discountAmount}%</p>
                    <p><strong>Risparmiato:</strong> €${(bookingData.originalTotal - bookingData.totalAmount).toFixed(2)}</p>
                ` : `
                    <p><strong>Totale pagato:</strong> €${bookingData.totalAmount}</p>
                `}
            </div>
            
            <div class="footer">
                <p>La ringraziamo per l'acquisto!</p>
                <p>Presentati all'ingresso con un documento d'identità.</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

async function generateTicketPDF(bookingData, seat, index, ticketHolder) {
    const filename = `ticket_${bookingData.bookingCode}_${index}.pdf`;
    const filepath = path.join(TEMP_DIR, filename);
    
    const html = generateTicketHTML(bookingData, seat, index, ticketHolder);
    
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
        path: filepath,
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
    });
    await browser.close();
    
    return filepath;
}

async function sendTicketsByEmail(email, bookingData, seatsDetails, ticketHolders) {
    const pdfFiles = [];
    
    for (let i = 0; i < seatsDetails.length; i++) {
        const ticketHolder = ticketHolders && ticketHolders[i] ? ticketHolders[i] : { fullName: 'Non specificato' };
        const pdfPath = await generateTicketPDF(bookingData, seatsDetails[i], i + 1, ticketHolder);
        pdfFiles.push(pdfPath);
    }
    
    const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="${getTeamLogo('inter')}" alt="Inter Milan" style="width: 60px; margin-bottom: 10px;">
                <h2 style="color: #0c0d10; margin: 0;">FC Internazionale Milano</h2>
            </div>
            
            <h3 style="color: #0c0d10; text-align: center;">Pagamento confermato! ✅</h3>
            
            <p>Gentile <strong>${bookingData.username}</strong>,</p>
            
            <p>Il tuo pagamento è stato completato con successo. <strong>In allegato trovi i biglietti</strong> per la partita:</p>
            
            <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 15px 0;">
                <p style="margin: 5px 0;"><strong>🎟️ Partita:</strong> ${bookingData.event}</p>
                <p style="margin: 5px 0;"><strong>📅 Data:</strong> ${bookingData.date}</p>
                <p style="margin: 5px 0;"><strong>📍 Stadio:</strong> Giuseppe Meazza</p>
                <p style="margin: 5px 0;"><strong>💰 Totale pagato:</strong> €${bookingData.totalAmount}</p>
            </div>
            
            <p><strong>⚠️ IMPORTANTE:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Presentati all'ingresso con un documento d'identità</li>
                <li>I biglietti sono personali e non trasferibili</li>
                <li>Arriva con almeno 30 minuti di anticipo</li>
            </ul>
            
            <hr style="margin: 20px 0;">
            
            <p style="font-size: 12px; color: #666; text-align: center;">La ringraziamo per l'acquisto!</p>
        </div>
    `;
    
    const attachments = pdfFiles.map(file => ({
        filename: `biglietto_${bookingData.bookingCode}_${path.basename(file)}`,
        path: file
    }));
    
    await sendEmail(email, `🎟️ I tuoi biglietti - ${bookingData.event}`, emailHtml, attachments);
    
    setTimeout(() => {
        pdfFiles.forEach(file => {
            fs.unlink(file, (err) => {
                if (err) console.error('Errore cancellazione file:', err);
            });
        });
    }, 5000);
    
    console.log(`✅ Email con ${pdfFiles.length} biglietti in PDF inviata a ${email}`);
    return true;
}
// ===================================================

// ============ CONFIGURAZIONE BOT TELEGRAM ============
const TELEGRAM_BOT_TOKEN = '8666591680:AAHi_jROhyylF41yJUL8H_c0sVoM4C1cIhI';

let bot;
if (TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_TOKEN !== 'IL_TUO_TOKEN_QUI') {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
    console.log('🤖 Bot Telegram inizializzato con successo!');
    
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, `👋 Ciao! Benvenuto nel sistema di prenotazione dello Stadio Meazza!

📱 Usa la Web-App per prenotare i biglietti.
💰 Riceverai una conferma qui dopo il pagamento!

Per collegare il tuo account, invia il comando /connect seguito dal tuo ID utente.
Esempio: /connect 1

Per assistenza, contatta l'amministratore.`);
    });
    
    bot.onText(/\/connect (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = match[1];
        
        try {
            const user = await new Promise((resolve, reject) => {
                db.get('SELECT id FROM users WHERE id = ?', [userId], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
            
            if (user) {
                await new Promise((resolve, reject) => {
                    db.run('UPDATE users SET telegram_chat_id = ? WHERE id = ?', [chatId.toString(), userId], (err) => {
                        if (err) reject(err);
                        resolve();
                    });
                });
                bot.sendMessage(chatId, `✅ Account collegato con successo! Riceverai le conferme delle tue prenotazioni qui.`);
            } else {
                bot.sendMessage(chatId, `❌ Utente con ID ${userId} non trovato. Controlla il tuo ID e riprova.`);
            }
        } catch (error) {
            console.error('Errore collegamento Telegram:', error);
            bot.sendMessage(chatId, `❌ Errore durante il collegamento. Riprova più tardi.`);
        }
    });
} else {
    console.log('⚠️ Bot Telegram non configurato (token mancante)');
}

// Funzione per inviare notifiche Telegram
async function sendTelegramNotification(chatId, bookingDetails) {
    if (!bot || !chatId) return false;
    
    try {
        let message = ` *🎟️ CONFERMA PRENOTAZIONE 🎟️* 

📅 *Data:* ${new Date().toLocaleString('it-IT')}
🧾 *Codice:* ${bookingDetails.bookingCode}
🏟️ *Evento:* ${bookingDetails.event}
👤 *Posti:* ${bookingDetails.seats}
`;

        if (bookingDetails.paymentMethod) {
            const paymentIcon = bookingDetails.paymentMethod === 'credit_card' ? '💳' : '📱';
            const paymentName = bookingDetails.paymentMethod === 'credit_card' ? 'Carta di credito' : 'PayPal';
            message += `\n${paymentIcon} *Metodo:* ${paymentName}`;
        }
        
        if (bookingDetails.discountApplied && bookingDetails.discountAmount > 0) {
            message += `\n🏷️ *Sconto applicato:* ${bookingDetails.discountAmount}%`;
            if (bookingDetails.originalTotal) {
                const saved = bookingDetails.originalTotal - bookingDetails.totalAmount;
                message += `\n💰 *Totale originale:* €${bookingDetails.originalTotal.toFixed(2)}`;
                message += `\n✨ *Risparmiato:* €${saved.toFixed(2)}`;
            }
        }
        
        message += `\n\n💵 *Totale pagato:* €${bookingDetails.totalAmount}

📍 *Stadio Giuseppe Meazza*
Grazie e buon divertimento! ⚽`;

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        console.log(`✅ Notifica Telegram inviata a chatId: ${chatId}`);
        return true;
    } catch (error) {
        console.error('❌ Errore invio Telegram:', error);
        return false;
    }
}
// =====================================================

app.use(cors());
app.use(express.json());
app.use(express.static('../client'));

// Store connected clients
const clients = new Map();
const onlineUsers = new Map();

function broadcastOnlineUsers() {
  const usersList = Array.from(onlineUsers.values()).map(u => ({
    userId: u.userId,
    username: u.username,
    lastActivity: u.lastActivity
  }));
  
  const message = JSON.stringify({
    type: 'online_users_update',
    users: usersList,
    count: usersList.length
  });
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.isAdmin) {
      client.send(message);
    }
  });
}

async function isAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: 'Token mancante' });
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT role FROM users WHERE id = ?', [decoded.id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    if (user && user.role === 'admin') {
      req.userId = decoded.id;
      next();
    } else {
      res.status(403).json({ success: false, message: 'Accesso negato: non sei admin' });
    }
  } catch (error) {
    res.status(401).json({ success: false, message: 'Token non valido' });
  }
}

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  let userId = null;
  
  console.log(`🔌 Nuova connessione WebSocket da ${req.socket.remoteAddress || 'localhost'}`);
  
  ws.on('message', async (message) => {
    const data = JSON.parse(message);
    
    switch (data.type) {
      case 'auth':
        userId = data.userId;
        clients.set(userId, ws);
        ws.userId = userId;
        
        const user = await new Promise((resolve, reject) => {
          db.get('SELECT username, role FROM users WHERE id = ?', [userId], (err, row) => {
            if (err) reject(err);
            resolve(row);
          });
        });
        
        ws.username = user?.username || 'Sconosciuto';
        ws.isAdmin = user?.role === 'admin';
        
        onlineUsers.set(userId, {
          userId: userId,
          username: ws.username,
          lastActivity: Date.now()
        });
        
        broadcastOnlineUsers();
        console.log(`✅ Utente autenticato via WebSocket: ID ${userId} (${ws.username})`);
        break;
        
      case 'lock_seat':
        await handleLockSeat(data.seatId, data.eventId, data.userId, ws);
        break;
        
      case 'unlock_seat':
        await handleUnlockSeat(data.seatId, data.userId);
        break;
        
      case 'confirm_booking':
        await handleConfirmBooking(data.seatId, data.eventId, data.userId, ws);
        break;
        
      case 'ping':
        if (userId && onlineUsers.has(userId)) {
          onlineUsers.get(userId).lastActivity = Date.now();
        }
        break;
    }
  });
  
  ws.on('close', () => {
    if (userId) {
      clients.delete(userId);
      onlineUsers.delete(userId);
      broadcastOnlineUsers();
      releaseUserLocks(userId);
      console.log(`❌ Utente disconnesso (WebSocket): ID ${userId}`);
    }
  });
});

async function handleLockSeat(seatId, eventId, userId, ws) {
  const now = new Date();
  const expireTime = new Date(now.getTime() + 60000);
  
  try {
    const seat = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM seats WHERE id = ? AND event_id = ?', [seatId, eventId], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    if (!seat) {
      ws.send(JSON.stringify({
        type: 'lock_failed',
        seatId: seatId,
        reason: 'Posto non trovato. Ricarica la pagina.'
      }));
      return;
    }
    
    if (seat.status === 'available' || (seat.status === 'locked' && seat.locked_by === userId)) {
      await new Promise((resolve, reject) => {
        db.run(`
          UPDATE seats 
          SET status = 'locked', 
              locked_by = ?, 
              locked_at = ?
          WHERE id = ? AND (status = 'available' OR (status = 'locked' AND locked_by = ?))
        `, [userId, now.toISOString(), seatId, userId], function(err) {
          if (err) reject(err);
          resolve(this);
        });
      });
      
      broadcastSeatUpdate(seatId, 'locked', userId);
      
      setTimeout(async () => {
        await autoUnlockSeat(seatId, userId);
      }, 60000);
      
      ws.send(JSON.stringify({
        type: 'lock_success',
        seatId: seatId,
        expiresAt: expireTime
      }));
    } else {
      ws.send(JSON.stringify({
        type: 'lock_failed',
        seatId: seatId,
        reason: 'Seat is not available'
      }));
    }
  } catch (error) {
    console.error('Error locking seat:', error);
  }
}

async function handleUnlockSeat(seatId, userId) {
  try {
    await new Promise((resolve, reject) => {
      db.run(`
        UPDATE seats 
        SET status = 'available', 
            locked_by = NULL, 
            locked_at = NULL
        WHERE id = ? AND locked_by = ?
      `, [seatId, userId], function(err) {
        if (err) reject(err);
        resolve(this);
      });
    });
    
    broadcastSeatUpdate(seatId, 'available', null);
  } catch (error) {
    console.error('Error unlocking seat:', error);
  }
}

async function autoUnlockSeat(seatId, userId) {
  try {
    await new Promise((resolve, reject) => {
      db.run(`
        UPDATE seats 
        SET status = 'available', 
            locked_by = NULL, 
            locked_at = NULL
        WHERE id = ? AND locked_by = ? AND status = 'locked'
      `, [seatId, userId], function(err) {
        if (err) reject(err);
        resolve(this);
      });
    });
    
    broadcastSeatUpdate(seatId, 'available', null);
  } catch (error) {
    console.error('Error auto-unlocking seat:', error);
  }
}

async function releaseUserLocks(userId) {
  try {
    await new Promise((resolve, reject) => {
      db.run(`
        UPDATE seats 
        SET status = 'available', 
            locked_by = NULL, 
            locked_at = NULL
        WHERE locked_by = ? AND status = 'locked'
      `, [userId], function(err) {
        if (err) reject(err);
        resolve(this);
      });
    });
  } catch (error) {
    console.error('Error releasing user locks:', error);
  }
}

function broadcastSeatUpdate(seatId, status, userId) {
  const message = JSON.stringify({
    type: 'seat_update',
    seatId: seatId,
    status: status,
    userId: userId
  });
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// ============ REST API ENDPOINTS ============

// Register
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, message: 'La password deve essere di almeno 6 caratteri' });
  }
  
  if (!email || !email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ success: false, message: 'Email non valida' });
  }
  
  try {
    const existingUsername = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    if (existingUsername) {
      return res.status(400).json({ success: false, message: 'Username già in uso' });
    }
    
    const existingEmail = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'Email già registrata' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hashedPassword],
        function(err) {
          if (err) reject(err);
          resolve(this.lastID);
        }
      );
    });
    
    res.json({ success: true, message: 'Utente registrato con successo' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Errore durante la registrazione' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Credenziali errate' });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Credenziali errate' });
    }
    
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );
    
    console.log(`🔐 LOGIN: ${user.username} (${user.email}) - ID: ${user.id} - ${new Date().toLocaleString('it-IT')}`);
    
    res.json({
      success: true,
      token,
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email,
        role: user.role || 'user'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// FORGOT PASSWORD
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  if (!email || !email.includes('@')) {
    return res.json({ success: false, message: 'Inserisci un email valida' });
  }
  
  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT id, username, email FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    if (!user) {
      return res.json({ success: false, message: 'Email non trovata' });
    }
    
    const resetToken = generateResetToken();
    const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?',
        [resetToken, resetExpires.toISOString(), user.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    const resetLink = `http://localhost:3000/reset-password.html?token=${resetToken}`;
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${getTeamLogo('inter')}" alt="Inter Milan" style="width: 80px; margin-bottom: 10px;">
          <h2 style="color: #0c0d10;">FC Internazionale Milano</h2>
        </div>
        <p>Gentile <strong>${user.username}</strong>,</p>
        <p>per poter effettuare il cambio password che hai richiesto:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Clicca qui</a>
        </div>
        <p>Oppure copia e incolla questo link nel tuo browser:</p>
        <p style="background: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all;">${resetLink}</p>
        <p><strong>⚠️ Questo link scadrà tra 24 ore.</strong></p>
        <hr style="margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">Se non sei stato tu a richiedere il cambio della password, ignora questo messaggio. La tua password rimarrà invariata.</p>
        <p style="font-size: 12px; color: #666;">Grazie,<br>La Direzione.</p>
      </div>
    `;
    
    await sendEmail(user.email, 'Reset password - FC Internazionale Milano', emailHtml);
    
    res.json({ 
      success: true, 
      message: 'Ti abbiamo inviato un email con le istruzioni per reimpostare la tua password.'
    });
    
  } catch (error) {
    console.error('Errore forgot-password:', error);
    res.status(500).json({ success: false, message: 'Errore del server' });
  }
});

// RESET PASSWORD
app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'La password deve essere di almeno 6 caratteri' });
  }
  
  try {
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, username, email FROM users WHERE reset_token = ? AND reset_expires > ?',
        [token, new Date().toISOString()],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });
    
    if (!user) {
      return res.status(400).json({ success: false, message: 'Link non valido o scaduto. Richiedi un nuovo reset.' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
        [hashedPassword, user.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    const confirmEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${getTeamLogo('inter')}" alt="Inter Milan" style="width: 80px; margin-bottom: 10px;">
          <h2 style="color: #0c0d10;">FC Internazionale Milano</h2>
        </div>
        <p>Gentile <strong>${user.username}</strong>,</p>
        <p>La tua password è stata aggiornata con successo!</p>
        <p>Se non hai effettuato tu questa modifica, contatta immediatamente il supporto.</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="http://localhost:3000/login.html" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px;">Accedi ora</a>
        </div>
        <p style="font-size: 12px; color: #666;">Grazie,<br>La Direzione.</p>
      </div>
    `;
    
    await sendEmail(user.email, 'Password aggiornata - FC Internazionale Milano', confirmEmailHtml);
    
    res.json({ success: true, message: 'Password aggiornata con successo!' });
    
  } catch (error) {
    console.error('Errore reset-password:', error);
    res.status(500).json({ success: false, message: 'Errore del server' });
  }
});

// FORGOT USERNAME
app.post('/api/forgot-username', async (req, res) => {
  const { email } = req.body;
  
  if (!email || !email.includes('@')) {
    return res.json({ success: false, message: 'Inserisci un email valida' });
  }
  
  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT id, username, email FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    if (!user) {
      return res.json({ success: false, message: 'Email non trovata' });
    }
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${getTeamLogo('inter')}" alt="Inter Milan" style="width: 80px; margin-bottom: 10px;">
          <h2 style="color: #0c0d10;">FC Internazionale Milano</h2>
        </div>
        <p>Gentile <strong>${user.username}</strong>,</p>
        <p>Come richiesto, ecco il tuo username per accedere al sistema di prenotazione:</p>
        <div style="text-align: center; margin: 25px 0;">
          <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; display: inline-block;">
            <span style="font-size: 24px; font-weight: bold; color: #0c0d10;">${user.username}</span>
          </div>
        </div>
        <p>Puoi utilizzare questo username per accedere al tuo account.</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="http://localhost:3000/login.html" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px;">Accedi ora</a>
        </div>
        <hr style="margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">Se non hai richiesto tu il recupero dell'username, ignora questo messaggio.</p>
        <p style="font-size: 12px; color: #666;">Grazie,<br>La Direzione.</p>
      </div>
    `;
    
    await sendEmail(user.email, 'Recupero username - FC Internazionale Milano', emailHtml);
    
    res.json({ 
      success: true, 
      message: `Ti abbiamo inviato il tuo username all'indirizzo email ${user.email}.`
    });
    
  } catch (error) {
    console.error('Errore forgot-username:', error);
    res.status(500).json({ success: false, message: 'Errore del server' });
  }
});

app.get('/api/admin/verify', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.json({ isAdmin: false });
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT role FROM users WHERE id = ?', [decoded.id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    res.json({ isAdmin: user && user.role === 'admin', role: user?.role });
  } catch (error) {
    res.json({ isAdmin: false });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    const events = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM events ORDER BY date ASC', (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/tickets-sold', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: 'Token mancante' });
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT role FROM users WHERE id = ?', [decoded.id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Accesso negato' });
    }
    
    const { eventId, startDate, endDate } = req.query;
    let query = `
      SELECT 
        b.booking_code,
        b.total_amount,
        b.payment_status,
        b.created_at,
        u.username,
        u.email,
        e.id as event_id,
        e.name as event_name,
        e.date as event_date,
        e.home_team,
        e.away_team,
        s.seat_number,
        s.sector,
        s.price
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN events e ON b.event_id = e.id
      JOIN seats s ON b.seat_id = s.id
      WHERE b.payment_status = 'completed'
    `;
    
    const params = [];
    
    if (eventId) {
      query += ` AND e.id = ?`;
      params.push(eventId);
    }
    
    if (startDate) {
      query += ` AND e.date >= ?`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND e.date <= ?`;
      params.push(endDate);
    }
    
    query += ` ORDER BY e.date DESC, b.created_at DESC`;
    
    const tickets = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
    
    const events = await new Promise((resolve, reject) => {
      db.all('SELECT id, name, home_team, away_team, date FROM events ORDER BY date DESC', (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
    
    res.json({ success: true, tickets, events });
  } catch (error) {
    console.error('Errore tickets sold:', error);
    res.status(500).json({ success: false, message: 'Errore del server' });
  }
});

app.get('/api/admin/sectors/:eventId', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false });
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT role FROM users WHERE id = ?', [decoded.id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Accesso negato' });
    }
    
    const sectors = await new Promise((resolve, reject) => {
      db.all('SELECT DISTINCT sector, price FROM seats WHERE event_id = ? ORDER BY sector', [req.params.eventId], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
    
    res.json({ success: true, sectors });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.post('/api/admin/update-price', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false });
  
  const token = authHeader.split(' ')[1];
  const { eventId, sector, newPrice } = req.body;
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT role FROM users WHERE id = ?', [decoded.id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Accesso negato' });
    }
    
    await new Promise((resolve, reject) => {
      db.run('UPDATE seats SET price = ? WHERE event_id = ? AND sector = ?', [newPrice, eventId, sector], function(err) {
        if (err) reject(err);
        resolve(this);
      });
    });
    
    const priceUpdateMessage = JSON.stringify({
      type: 'price_update',
      eventId: eventId,
      sector: sector,
      newPrice: newPrice
    });
    
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(priceUpdateMessage);
      }
    });
    
    res.json({ success: true, message: `Prezzo del settore ${sector} aggiornato a €${newPrice}` });
  } catch (error) {
    console.error('Errore aggiornamento prezzo:', error);
    res.status(500).json({ success: false });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false });
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT role FROM users WHERE id = ?', [decoded.id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false });
    }
    
    const ticketsPerMatch = await new Promise((resolve, reject) => {
      db.all(`
        SELECT e.home_team, e.away_team, COUNT(*) as count 
        FROM bookings b
        JOIN events e ON b.event_id = e.id
        WHERE b.payment_status = 'completed'
        GROUP BY b.event_id
        ORDER BY count DESC
      `, [], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
    
    const salesTrend = await new Promise((resolve, reject) => {
      db.all(`
        SELECT strftime('%Y-%m', b.created_at) as month, COUNT(*) as count, SUM(s.price) as revenue
        FROM bookings b
        JOIN seats s ON b.seat_id = s.id
        WHERE b.payment_status = 'completed'
        GROUP BY month
        ORDER BY month ASC
      `, [], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
    
    const popularSectors = await new Promise((resolve, reject) => {
      db.all(`
        SELECT s.sector, COUNT(*) as count
        FROM bookings b
        JOIN seats s ON b.seat_id = s.id
        WHERE b.payment_status = 'completed'
        GROUP BY s.sector
        ORDER BY count DESC
        LIMIT 5
      `, [], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
    
    res.json({ success: true, ticketsPerMatch, salesTrend, popularSectors });
  } catch (error) {
    console.error('Errore stats:', error);
    res.status(500).json({ success: false });
  }
});

app.get('/api/events/:eventId', async (req, res) => {
  try {
    const event = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM events WHERE id = ?', [req.params.eventId], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/seats/:eventId', async (req, res) => {
  try {
    const seats = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM seats WHERE event_id = ? ORDER BY sector, row_number, seat_number',
        [req.params.eventId],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        }
      );
    });
    res.json(seats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/create-booking', async (req, res) => {
  const { userId, eventId, seatIds, totalAmount } = req.body;
  const expiresAt = new Date(Date.now() + 600000);
  
  console.log('\n🔍 ===== RICEVUTA RICHIESTA PRENOTAZIONE =====');
  console.log('userId:', userId);
  console.log('eventId:', eventId);
  console.log('seatIds:', seatIds);
  console.log('totalAmount:', totalAmount);
  
  try {
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        resolve();
      });
    });
    
    for (const seatId of seatIds) {
      console.log(`\n--- Verifico posto ID ${seatId} ---`);
      
      const seat = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM seats WHERE id = ? AND event_id = ?', [seatId, eventId], (err, row) => {
          if (err) reject(err);
          resolve(row);
        });
      });
      
      if (!seat) {
        throw new Error(`Posto con ID ${seatId} non esiste per questo evento`);
      }
      
      console.log(`Posto: ${seat.seat_number}, stato: ${seat.status}, locked_by: ${seat.locked_by}`);
      
      if (seat.status !== 'locked' || seat.locked_by !== userId) {
        throw new Error(`Posto ${seat.seat_number} non è bloccato dall'utente. Stato: ${seat.status}, locked_by: ${seat.locked_by}`);
      }
    }
    
    const mainBookingCode = uuidv4().substring(0, 8).toUpperCase() + Date.now().toString(36).toUpperCase();
    
    for (const seatId of seatIds) {
      const uniqueBookingCode = `${mainBookingCode}-${seatId}`;
      
      console.log(`📝 Inserisco booking per posto ${seatId} con codice: ${uniqueBookingCode}`);
      
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO bookings (user_id, event_id, seat_id, booking_code, status, expires_at, total_amount)
           VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
          [userId, eventId, seatId, uniqueBookingCode, expiresAt.toISOString(), totalAmount],
          function(err) {
            if (err) {
              console.error(`❌ Errore INSERT booking ${seatId}:`, err);
              reject(err);
            } else {
              console.log(`   ✅ Booking inserito con ID: ${this.lastID}`);
              resolve(this.lastID);
            }
          }
        );
      });
      
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE seats SET status = 'booked', booked_by = ?, booked_at = CURRENT_TIMESTAMP
           WHERE id = ? AND status = 'locked' AND locked_by = ?`,
          [userId, seatId, userId],
          function(err) {
            if (err) {
              console.error(`❌ Errore UPDATE seat ${seatId}:`, err);
              reject(err);
            } else {
              console.log(`   ✅ Posto aggiornato a 'booked'`);
              resolve(this);
            }
          }
        );
      });
      
      broadcastSeatUpdate(seatId, 'booked', userId);
    }
    
    await new Promise((resolve, reject) => {
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        resolve();
      });
    });
    
    console.log('\n🎉 PRENOTAZIONE CREATA CON SUCCESSO! 🎉');

    res.json({
      success: true,
      bookingId: mainBookingCode,  
      bookingCode: mainBookingCode,
      expiresAt: expiresAt
    });
  } catch (error) {
    console.error('\n❌ ERRORE DURANTE LA PRENOTAZIONE:');
    console.error('Messaggio:', error.message);
    
    await new Promise((resolve) => {
      db.run('ROLLBACK', () => resolve());
    });
    
    res.status(500).json({ success: false, message: error.message });
  }
});

// Process payment
app.post('/api/process-payment', async (req, res) => {
  const { bookingId, paymentMethod, totalAmount, discountApplied, discountAmount, ticketHolders } = req.body;
  
  console.log('\n💰 RICEVUTO PAGAMENTO:');
  console.log('bookingId ricevuto:', bookingId);
  console.log('ticketHolders ricevuti:', ticketHolders);
  
  try {
    let booking = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM bookings WHERE booking_code LIKE ?', [bookingId + '%'], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    console.log('📦 Booking trovato (con LIKE):', booking);
    
    if (!booking) {
      console.log('❌ Booking non trovato!');
      return res.status(404).json({ success: false, message: 'Prenotazione non trovata' });
    }
    
    if (booking.payment_status === 'completed') {
      console.log('❌ Booking già pagato!');
      return res.status(400).json({ success: false, message: 'Prenotazione già pagata' });
    }
    
    if (new Date(booking.expires_at) < new Date()) {
      console.log('❌ Booking scaduto!');
      return res.status(400).json({ success: false, message: 'Prenotazione scaduta' });
    }
    
    const bookingDetails = await new Promise((resolve, reject) => {
      db.get(`
        SELECT b.*, u.username, u.email, e.home_team, e.away_team, e.date,
               (SELECT SUM(price) FROM seats WHERE id IN (SELECT seat_id FROM bookings WHERE booking_code LIKE ?)) as original_total
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN events e ON b.event_id = e.id
        WHERE b.booking_code LIKE ?
      `, [bookingId + '%', bookingId + '%'], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    const seatsDetails = await new Promise((resolve, reject) => {
      db.all(`
        SELECT s.seat_number, s.sector, s.price
        FROM seats s
        JOIN bookings b ON b.seat_id = s.id
        WHERE b.booking_code LIKE ?
      `, [bookingId + '%'], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE bookings 
         SET payment_status = 'completed', 
             status = 'confirmed',
             total_amount = ?
         WHERE booking_code LIKE ?`,
        [totalAmount, bookingId + '%'],
        function(err) {
          if (err) reject(err);
          console.log(`   ✅ Rows aggiornate: ${this.changes}`);
          resolve(this);
        }
      );
    });
    
    console.log('\n💰 ========== PAGAMENTO COMPLETATO ==========');
    console.log(`📅 Data/Ora: ${new Date().toLocaleString('it-IT')}`);
    console.log(`👤 Utente: ${bookingDetails.username} (${bookingDetails.email}) - ID: ${bookingDetails.user_id}`);
    console.log(`⚽ Partita: ${bookingDetails.home_team} vs ${bookingDetails.away_team}`);
    console.log(`📆 Data partita: ${new Date(bookingDetails.date).toLocaleString('it-IT')}`);
    console.log(`💺 Posti:`);
    seatsDetails.forEach(seat => {
      console.log(`   - ${seat.seat_number} (${seat.sector}) - €${seat.price}`);
    });
    console.log(`💳 Metodo: ${paymentMethod === 'credit_card' ? '💳 Carta di credito' : '📱 PayPal'}`);
    
    if (discountApplied && discountAmount > 0) {
      const originalTotalCalc = bookingDetails.original_total || totalAmount / (1 - discountAmount/100);
      const savedAmount = originalTotalCalc - totalAmount;
      console.log(`🏷️  SCONTO APPLICATO: ${discountAmount}%`);
      console.log(`   Totale originale: €${originalTotalCalc.toFixed(2)}`);
      console.log(`   Risparmiato: €${savedAmount.toFixed(2)}`);
    }
    
    console.log(`💰 Totale pagato: €${totalAmount.toFixed(2)}`);
    console.log(`🔑 Codice prenotazione: ${bookingId}`);
    console.log('==========================================\n');
    
    // ============ INVIO NOTIFICA TELEGRAM ============
    const userTelegram = await new Promise((resolve, reject) => {
        db.get('SELECT telegram_chat_id FROM users WHERE id = ?', [bookingDetails.user_id], (err, row) => {
            if (err) reject(err);
            resolve(row);
        });
    });
    
    if (userTelegram && userTelegram.telegram_chat_id) {
        const seatsList = seatsDetails.map(s => `${s.seat_number} (${s.sector})`).join(', ');
        
        let originalTotal = totalAmount;
        if (discountApplied && discountAmount > 0) {
            originalTotal = totalAmount / (1 - discountAmount / 100);
        }
        
        const telegramDetails = {
            bookingCode: bookingId,
            event: `${bookingDetails.home_team} vs ${bookingDetails.away_team}`,
            seats: seatsList,
            totalAmount: totalAmount,
            paymentMethod: paymentMethod,
            discountApplied: discountApplied || false,
            discountAmount: discountAmount || 0,
            originalTotal: originalTotal
        };
        
        console.log('📤 INVIO NOTIFICA TELEGRAM CON DETTAGLI:', {
            paymentMethod: paymentMethod,
            discountApplied: discountApplied,
            discountAmount: discountAmount,
            originalTotal: originalTotal
        });
        
        await sendTelegramNotification(userTelegram.telegram_chat_id, telegramDetails);
    }
    
    // ============ INVIO EMAIL CON BIGLIETTI PDF ============
    try {
        let originalTotalForPdf = totalAmount;
        let discountAppliedFlag = false;
        let discountAmountValue = 0;
        
        if (discountApplied && discountAmount > 0) {
            originalTotalForPdf = totalAmount / (1 - discountAmount / 100);
            discountAppliedFlag = true;
            discountAmountValue = discountAmount;
        }
        
        const pdfBookingData = {
            username: bookingDetails.username,
            bookingCode: bookingId,
            event: `${bookingDetails.home_team} vs ${bookingDetails.away_team}`,
            date: new Date(bookingDetails.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
            time: new Date(bookingDetails.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
            totalAmount: totalAmount.toFixed(2),
            originalTotal: originalTotalForPdf.toFixed(2),
            discountApplied: discountAppliedFlag,
            discountAmount: discountAmountValue,
            paymentMethod: paymentMethod
        };
        
        await sendTicketsByEmail(bookingDetails.email, pdfBookingData, seatsDetails, ticketHolders);
        console.log('✅ Email con PDF inviata con successo');
    } catch (pdfError) {
        console.error('❌ Errore invio PDF:', pdfError);
    }
    // =================================================
    
    res.json({
      success: true,
      message: 'Pagamento effettuato con successo',
      bookingCode: booking.booking_code
    });
  } catch (error) {
    console.error('❌ Errore nel pagamento:', error);
    res.status(500).json({ success: false, message: 'Errore interno del server' });
  }
});

app.get('/api/user-bookings/:userId', async (req, res) => {
  try {
    const bookings = await new Promise((resolve, reject) => {
      db.all(`
        SELECT b.*, e.name as event_name, e.date, e.home_team, e.away_team, s.seat_number, s.sector
        FROM bookings b
        JOIN events e ON b.event_id = e.id
        JOIN seats s ON b.seat_id = s.id
        WHERE b.user_id = ?
        ORDER BY b.created_at DESC
      `, [req.params.userId], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/booking/pay/:bookingId', async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.body.userId;
  
  console.log('💰 Pagamento prenotazione in sospeso:', bookingId);
  
  try {
    const bookingDetails = await new Promise((resolve, reject) => {
      db.all(`
        SELECT b.*, u.username, u.email, e.home_team, e.away_team, e.date, e.id as event_id,
               s.seat_number, s.sector, s.price
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN events e ON b.event_id = e.id
        JOIN seats s ON b.seat_id = s.id
        WHERE b.booking_code LIKE ? AND b.payment_status = 'pending'
      `, [bookingId + '%'], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
    
    if (!bookingDetails || bookingDetails.length === 0) {
      return res.status(404).json({ success: false, message: 'Prenotazione non trovata o già pagata' });
    }
    
    if (new Date(bookingDetails[0].expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'Prenotazione scaduta, impossibile pagare' });
    }
    
    const seatsList = bookingDetails.map(seat => ({
      seat_number: seat.seat_number,
      sector: seat.sector,
      price: seat.price
    }));
    
    const totalAmount = seatsList.reduce((sum, seat) => sum + seat.price, 0);
    
    const paymentData = {
      bookingId: bookingId,
      seats: seatsList,
      totalAmount: totalAmount,
      eventId: bookingDetails[0].event_id,
      expiresAt: bookingDetails[0].expires_at
    };
    
    res.json({ 
      success: true, 
      message: 'Reindirizzamento al pagamento',
      paymentData: paymentData
    });
  } catch (error) {
    console.error('Errore:', error);
    res.status(500).json({ success: false, message: 'Errore del server' });
  }
});

app.delete('/api/booking/:bookingId', async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.query.userId;
  
  try {
    const booking = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM bookings WHERE booking_code = ?', [bookingId], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Prenotazione non trovata' });
    }
    
    if (booking.payment_status === 'completed') {
      return res.status(400).json({ success: false, message: 'Impossibile cancellare: biglietto già pagato' });
    }
    
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM bookings WHERE booking_code = ?', [bookingId], function(err) {
        if (err) reject(err);
        resolve(this);
      });
    });
    
    await new Promise((resolve, reject) => {
      db.run('UPDATE seats SET status = "available", locked_by = NULL, locked_at = NULL WHERE id = ?', [booking.seat_id], function(err) {
        if (err) reject(err);
        resolve(this);
      });
    });
    
    broadcastSeatUpdate(booking.seat_id, 'available', null);
    
    res.json({ success: true, message: 'Prenotazione cancellata con successo' });
  } catch (error) {
    console.error('Errore cancellazione:', error);
    res.status(500).json({ success: false, message: 'Errore del server' });
  }
});

app.post('/api/clean-expired-bookings', async (req, res) => {
  try {
    const expiredBookings = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM bookings WHERE expires_at < ? AND payment_status = "pending"', [new Date().toISOString()], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
    
    for (const booking of expiredBookings) {
      await new Promise((resolve, reject) => {
        db.run('UPDATE seats SET status = "available", locked_by = NULL, locked_at = NULL WHERE id = ?', [booking.seat_id], (err) => {
          if (err) reject(err);
          resolve();
        });
      });
      
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM bookings WHERE id = ?', [booking.id], (err) => {
          if (err) reject(err);
          resolve();
        });
      });
      
      broadcastSeatUpdate(booking.seat_id, 'available', null);
    }
    
    res.json({ success: true, message: `Eliminate ${expiredBookings.length} prenotazioni scadute` });
  } catch (error) {
    console.error('Errore pulizia prenotazioni:', error);
    res.status(500).json({ success: false, message: 'Errore del server' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server running on ws://localhost:${PORT}`);
});