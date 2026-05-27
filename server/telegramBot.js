// server/telegramBot.js
const TelegramBot = require('node-telegram-bot-api');

// IL TUO TOKEN DA @BotFather (sostituisci con il tuo!)
const TELEGRAM_BOT_TOKEN = '8666591680:AAHi_jROhyylF41yJUL8H_c0sVoM4C1cIhI';

// Inizializza il bot
let bot;

if (TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_TOKEN !== '8666591680:AAHi_jROhyylF41yJUL8H_c0sVoM4C1cIhI') {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
    console.log('🤖 Bot Telegram inizializzato con successo!');
} else {
    console.log('⚠️ Bot Telegram non configurato (token mancante)');
    // Crea un bot fittizio per evitare errori
    bot = {
        sendMessage: async () => false,
        onText: () => {}
    };
}

// Gestione comando /start
if (bot.onText) {
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const welcomeMessage = `👋 Ciao! Benvenuto nel sistema di prenotazione dello Stadio Meazza.

📱 Usa la nostra Web-App per prenotare i biglietti.
💰 Riceverai una conferma qui dopo il pagamento!

🔗 Accedi su: http://localhost:3000

Per collegare il tuo account, invia il comando /connect seguito dal tuo ID utente.
Esempio: /connect 1

Per assistenza, contatta l'amministratore.`;
        
        bot.sendMessage(chatId, welcomeMessage);
    });
}

// Gestione comando /connect
if (bot.onText) {
    bot.onText(/\/connect (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = match[1];
        
        // Nota: questo richiede l'accesso al database
        // Puoi importare il db qui o passarlo come parametro
        try {
            const db = require('./database');
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
}

// Funzione per inviare notifiche Telegram con dettagli completi
async function sendTelegramNotification(chatId, bookingDetails) {
    if (!bot || !chatId) return false;
    
    try {
        // Costruisci il messaggio con tutti i dettagli
        let message = `🎟️ *CONFERMA PRENOTAZIONE* 🎟️

📅 *Data:* ${new Date().toLocaleString('it-IT')}
🧾 *Codice:* ${bookingDetails.bookingCode}
🏟️ *Evento:* ${bookingDetails.event}
👤 *Posti:* ${bookingDetails.seats}
`;

        // Aggiungi i dettagli del pagamento
        if (bookingDetails.paymentMethod) {
            const paymentIcon = bookingDetails.paymentMethod === 'credit_card' ? '💳' : '📱';
            const paymentName = bookingDetails.paymentMethod === 'credit_card' ? 'Carta di Credito' : 'PayPal';
            message += `${paymentIcon} *Metodo:* ${paymentName}\n`;
        }
        
        // Aggiungi informazioni sullo sconto se presente
        if (bookingDetails.discountApplied && bookingDetails.discountAmount > 0) {
            message += `🏷️ *Sconto applicato:* ${bookingDetails.discountAmount}%\n`;
            if (bookingDetails.originalTotal) {
                const saved = bookingDetails.originalTotal - bookingDetails.totalAmount;
                message += `💰 *Totale originale:* €${bookingDetails.originalTotal.toFixed(2)}\n`;
                message += `✨ *Risparmiato:* €${saved.toFixed(2)}\n`;
            }
        }
        
        message += `💵 *Totale pagato:* €${bookingDetails.totalAmount}

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

module.exports = { bot, sendTelegramNotification };