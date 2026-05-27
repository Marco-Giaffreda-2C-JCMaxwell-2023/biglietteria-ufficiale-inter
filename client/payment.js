let currentBooking = null;
let discountApplied = false;
let discountAmount = 0;
let originalTotal = 0;
let currentUser = null;

// Applica il tema salvato anche nella pagina di pagamento
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
}

// Recupera utente corrente
try {
    const userData = localStorage.getItem('user');
    if (userData) {
        currentUser = JSON.parse(userData);
    }
} catch (error) {
    console.error('Errore recupero utente:', error);
}

// Codici sconto validi
const discountCodes = {
    'INTER10': 10,
    'INTERFOREVER': 50,
    'FORZAINTER': 25,
    'WELCOME5': 5
};

// ============ SETUP BANNER TELEGRAM ============
function setupTelegramBanner() {
    // Mostra l'ID utente
    const userIdSpan = document.getElementById('telegramUserId');
    if (userIdSpan && currentUser && currentUser.id) {
        userIdSpan.textContent = currentUser.id;
    } else if (userIdSpan) {
        userIdSpan.textContent = '?';
    }
    
    // Genera QR code per il bot Telegram
    const qrDiv = document.getElementById('telegramQrCode');
    if (qrDiv && typeof QRCode !== 'undefined') {
        const botUsername = 'StadioMeazzaBot';
        const botLink = `https://t.me/${botUsername}`;
        
        try {
            new QRCode(qrDiv, {
                text: botLink,
                width: 75,
                height: 75,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        } catch (error) {
            console.error('Errore generazione QR:', error);
            qrDiv.innerHTML = '<span style="font-size: 10px;">QR</span>';
        }
    }
}
// ===============================================

// ============ GESTIONE INTESTATARI BIGLIETTI ============
function generateTicketHoldersFields() {
    const container = document.getElementById('ticketHoldersContainer');
    if (!container || !currentBooking || !currentBooking.seats) return;
    
    const seatsCount = currentBooking.seats.length;
    
    if (seatsCount === 0) {
        container.innerHTML = '<p style="color: var(--text-2);">Nessun posto selezionato</p>';
        return;
    }
    
    let html = '';
    for (let i = 0; i < seatsCount; i++) {
        const seat = currentBooking.seats[i];
        html += `
            <div style="margin-bottom: 15px; padding: 12px; background: var(--bg-2); border-radius: 12px; border: 1px solid var(--border);">
                <div style="font-weight: bold; margin-bottom: 8px; color: var(--accent);">
                     Biglietto ${i+1} - Posto ${seat.seat_number} (${seat.sector})
                </div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <div style="flex: 1;">
                        <label style="font-size: 11px; display: block; margin-bottom: 4px;">Nome</label>
                        <input type="text" id="firstName_${i}" placeholder="Nome" class="ticket-holder-input" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-1); color: var(--text-1);">
                    </div>
                    <div style="flex: 1;">
                        <label style="font-size: 11px; display: block; margin-bottom: 4px;">Cognome</label>
                        <input type="text" id="lastName_${i}" placeholder="Cognome" class="ticket-holder-input" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-1); color: var(--text-1);">
                    </div>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function getTicketHolders() {
    if (!currentBooking || !currentBooking.seats) return [];
    
    const seatsCount = currentBooking.seats.length;
    const holders = [];
    for (let i = 0; i < seatsCount; i++) {
        const firstName = document.getElementById(`firstName_${i}`)?.value || '';
        const lastName = document.getElementById(`lastName_${i}`)?.value || '';
        holders.push({
            seat_number: currentBooking.seats[i].seat_number,
            sector: currentBooking.seats[i].sector,
            firstName: firstName,
            lastName: lastName,
            fullName: `${firstName} ${lastName}`.trim() || 'Non specificato'
        });
    }
    return holders;
}
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    const bookingData = localStorage.getItem('currentBooking');
    
    if (!bookingData) {
        window.location.href = 'index.html';
        return;
    }
    
    currentBooking = JSON.parse(bookingData);
    
    if (!currentBooking.bookingId && currentBooking.bookingCode) {
        currentBooking.bookingId = currentBooking.bookingCode;
    }
    
    originalTotal = currentBooking.totalAmount;
    
    if (new Date(currentBooking.expiresAt) < new Date()) {
        showError('La prenotazione è scaduta. Seleziona nuovamente i posti.');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
        return;
    }
    
    displayBookingDetails();
    startTimer();
    setupTelegramBanner();
    
    // Cambio metodo di pagamento
    document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const creditCardForm = document.getElementById('creditCardForm');
            const paypalForm = document.getElementById('paypalForm');
            if (e.target.value === 'credit_card') {
                creditCardForm.style.display = 'block';
                paypalForm.style.display = 'none';
            } else {
                creditCardForm.style.display = 'none';
                paypalForm.style.display = 'block';
            }
        });
    });
    
    // Applica sconto
    document.getElementById('applyDiscountBtn').addEventListener('click', applyDiscount);
    
    // Submit pagamento
    document.getElementById('paymentForm').addEventListener('submit', processPayment);
});

async function displayBookingDetails() {
    const bookingDetailsDiv = document.getElementById('bookingDetails');
    const totalAmountSpan = document.getElementById('totalAmount');
    
    try {
        const response = await fetch(`/api/events/${currentBooking.eventId}`);
        const event = await response.json();
        const date = new Date(event.date);
        
        bookingDetailsDiv.innerHTML = `
            <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #e0e0e0;">
                <strong>Partita:</strong> ${event.home_team} vs ${event.away_team}<br>
                <strong>Data:</strong> ${date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}<br>
                <strong>Orario:</strong> ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}<br>
                <strong>Stadio:</strong> Giuseppe Meazza
            </div>
            ${currentBooking.seats.map(seat => `
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span>${seat.seat_number} (${seat.sector})</span>
                    <span>€${seat.price}</span>
                </div>
            `).join('')}
        `;
    } catch (error) {
        bookingDetailsDiv.innerHTML = currentBooking.seats.map(seat => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>${seat.seat_number} (${seat.sector})</span>
                <span>€${seat.price}</span>
            </div>
        `).join('');
    }
    
    updateTotalDisplay();
    
    // GENERA I CAMPI PER GLI INTESTATARI
    generateTicketHoldersFields();
}

function updateTotalDisplay() {
    let finalTotal = originalTotal;
    if (discountApplied) {
        finalTotal = originalTotal - (originalTotal * discountAmount / 100);
    }
    document.getElementById('totalAmount').textContent = `€${finalTotal.toFixed(2)}`;
}

function applyDiscount() {
    const codeInput = document.getElementById('discountCode');
    const code = codeInput.value.trim().toUpperCase();
    const messageDiv = document.getElementById('discountMessage');
    
    if (discountCodes[code]) {
        discountApplied = true;
        discountAmount = discountCodes[code];
        messageDiv.innerHTML = `✅ Sconto del ${discountAmount}% applicato!`;
        messageDiv.style.color = 'green';
        updateTotalDisplay();
    } else {
        discountApplied = false;
        discountAmount = 0;
        messageDiv.innerHTML = '❌ Codice sconto non valido';
        messageDiv.style.color = 'red';
        updateTotalDisplay();
    }
}

// ============================================================
// TIMER - ORIGINALE (NON MODIFICATO)
// ============================================================
function startTimer() {
    const countdownFloatElement = document.getElementById('countdownFloat');
    const timerFloatDiv = document.getElementById('timerFloat');
    
    if (timerFloatDiv) {
        timerFloatDiv.style.display = 'block';
    }
    
    if (!countdownFloatElement) {
        console.error('❌ Elemento countdown non trovato!');
        return;
    }
    
    const expiryTime = new Date().getTime() + 600000;
    console.log('⏱️ Timer partito: 10 minuti');
    let warningTriggered = false;
    
    const timer = setInterval(() => {
        const now = new Date().getTime();
        const distance = expiryTime - now;
        
        if (distance < 0) {
            clearInterval(timer);
            showError('Prenotazione scaduta!');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }
        
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        countdownFloatElement.textContent = timeString;
        
        if (distance < 120000 && !warningTriggered && timerFloatDiv) {
            warningTriggered = true;
            timerFloatDiv.style.background = 'linear-gradient(135deg, #2a1a1a 0%, #3a1a1a 100%)';
            timerFloatDiv.style.border = '1px solid rgba(240, 79, 79, 0.6)';
            countdownFloatElement.style.color = '#f04f4f';
        }
    }, 1000);
}

// ============================================================
// PROCESS PAYMENT
// ============================================================
async function processPayment(e) {
    e.preventDefault();
    
    console.log('🔍 currentBooking:', currentBooking);
    
    const bookingIdToSend = currentBooking.bookingId || currentBooking.bookingCode;
    if (!bookingIdToSend) {
        showError('Dati prenotazione mancanti. Torna alla selezione posti.');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }
    console.log('📤 Invio bookingId:', bookingIdToSend);
    
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    
    if (paymentMethod === 'credit_card') {
        const cardNumber = document.getElementById('cardNumber').value;
        const expiryDate = document.getElementById('expiryDate').value;
        const cvv = document.getElementById('cvv').value;
        
        if (!cardNumber || !expiryDate || !cvv) {
            showError('Compila tutti i dati della carta');
            return;
        }
        if (cardNumber.replace(/\s/g, '').length !== 16) {
            showError('Numero carta non valido');
            return;
        }
        if (!/^\d{2}\/\d{2}$/.test(expiryDate)) {
            showError('Data scadenza non valida (MM/YY)');
            return;
        }
        if (cvv.length !== 3) {
            showError('CVV non valido');
            return;
        }
    } else if (paymentMethod === 'paypal') {
        const email = document.getElementById('paypalEmail').value;
        const password = document.getElementById('paypalPassword').value;
        if (!email || !password) {
            showError('Inserisci email e password PayPal');
            return;
        }
        if (!email.includes('@')) {
            showError('Email PayPal non valida');
            return;
        }
    }
    
    let finalTotal = currentBooking.totalAmount;
    if (discountApplied) {
        finalTotal = currentBooking.totalAmount - (currentBooking.totalAmount * discountAmount / 100);
    }
    
    console.log('📤 INVIO PAGAMENTO:');
    console.log('bookingId inviato:', bookingIdToSend);
    console.log('paymentMethod:', paymentMethod);
    console.log('totalAmount:', finalTotal);
    
    const payButton = document.querySelector('.btn-pay');
    const originalText = payButton.textContent;
    payButton.textContent = 'Elaborazione...';
    payButton.disabled = true;
    
    try {
        const response = await fetch('/api/process-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                bookingId: bookingIdToSend,
                paymentMethod: paymentMethod,
                totalAmount: finalTotal,
                discountApplied: discountApplied,
                discountAmount: discountAmount,
                ticketHolders: getTicketHolders()  // <-- AGGIUNTO
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('lastBooking', JSON.stringify({
                bookingCode: data.bookingCode,
                seats: currentBooking.seats,
                originalTotal: currentBooking.totalAmount,
                totalAmount: finalTotal,
                eventId: currentBooking.eventId,
                discountApplied: discountApplied,
                discountAmount: discountAmount,
                paymentMethod: paymentMethod
            }));
            window.location.href = 'confirmation.html';
        } else {
            showError(data.message);
            payButton.textContent = originalText;
            payButton.disabled = false;
        }
    } catch (error) {
        showError('Pagamento fallito. Riprova.');
        payButton.textContent = originalText;
        payButton.disabled = false;
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        background: #f44336;
        color: white;
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 20px;
        text-align: center;
    `;
    
    const form = document.getElementById('paymentForm');
    form.insertBefore(errorDiv, form.firstChild);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}