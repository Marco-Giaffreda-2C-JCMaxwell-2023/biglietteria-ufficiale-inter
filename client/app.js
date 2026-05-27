let ws;
let currentUser = null;
let selectedSeats = [];
let seatsData = [];
let currentEventId = null;
let events = [];

(function() {
    const savedTheme = localStorage.getItem('theme');
    if (!savedTheme) {
        localStorage.setItem('theme', 'dark');
        document.body.classList.remove('light-theme');
    } else if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
})();

// ============ TEMA CHIARO/SCURO ============
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        document.getElementById('themeToggle').textContent = '☀️';
    } else {
        document.body.classList.remove('light-theme');
        document.getElementById('themeToggle').textContent = '🌙';
    }
}

function toggleTheme() {
    if (document.body.classList.contains('light-theme')) {
        document.body.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
        document.getElementById('themeToggle').textContent = '🌙';
        // Aggiorna il logo Juventus se presente (torna bianco in tema scuro)
        updateJuventusLogoForTheme();
    } else {
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
        document.getElementById('themeToggle').textContent = '☀️';
        // Aggiorna il logo Juventus per tema chiaro
        updateJuventusLogoForTheme();
    }
}

function updateJuventusLogoForTheme() {
    // Aggiorna il logo della Juventus nella pagina principale e nella ricevuta
    const juveLogos = document.querySelectorAll('img[src*="juventus"]');
    const isLightTheme = document.body.classList.contains('light-theme');
    
    juveLogos.forEach(img => {
        if (img.src.includes('juventus-white')) {
            img.src = isLightTheme ? '/logos/juventus.png' : '/logos/juventus-white.png';
        }
    });
}

// ============ AUTO-LOGOUT PER INATTIVITÀ ==========
let inactivityTimer;
const INACTIVITY_TIME = 2 * 60 * 60 * 1000; // 2 ore

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        console.log('⏰ Auto-logout per inattività');
        logout();
    }, INACTIVITY_TIME);
}

function startInactivityTracking() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'keydown'];
    events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer);
    });
    resetInactivityTimer();
}

function stopInactivityTracking() {
    clearTimeout(inactivityTimer);
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'keydown'];
    events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer);
    });
}
// Check authentication
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (!token || !user) {
        window.location.href = 'login.html';
        return false;
    }

    currentUser = JSON.parse(user);
    document.getElementById('usernameDisplay').textContent = currentUser.username;

    // MOSTRA LINK ADMIN SE L'UTENTE È ADMIN
    if (currentUser.role === 'admin') {
        const adminLink = document.getElementById('adminLink');
        if (adminLink) {
            adminLink.style.display = 'inline-block';
        }
    }

    return true;
}

// Load available matches
async function loadMatches() {
    try {
        const response = await fetch('/api/events');
        events = await response.json();

        const matchSelect = document.getElementById('matchSelect');
        matchSelect.innerHTML = '<option value="">Seleziona una partita</option>';

        events.forEach(event => {
            const date = new Date(event.date);
            const option = document.createElement('option');
            option.value = event.id;
            option.textContent = `${event.home_team} vs ${event.away_team} - ${date.toLocaleDateString('it-IT')}`;
            matchSelect.appendChild(option);
        });

        if (events.length > 0) {
            matchSelect.value = events[0].id;
            loadMatchDetails(events[0].id);
        }

        matchSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                if (selectedSeats.length > 0) {
                    selectedSeats.forEach(seatId => unlockSeat(seatId));
                    selectedSeats = [];
                    updateSelectedSeatsList();
                }
                loadMatchDetails(parseInt(e.target.value));
            } else {
                document.getElementById('seatsContainer').innerHTML = '<div class="loading">Seleziona una partita per vedere i posti</div>';
                document.getElementById('awayTeamName').textContent = 'Seleziona partita';
                document.getElementById('matchDate').textContent = ' --';
                document.getElementById('matchTime').textContent = ' --';
            }
        });
    } catch (error) {
        console.error('Error loading matches:', error);
    }
}

// Load match details
async function loadMatchDetails(eventId) {
    currentEventId = eventId;

    try {
        const response = await fetch(`/api/events/${eventId}`);
        const event = await response.json();

        const date = new Date(event.date);
        let formattedDate = date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
        document.getElementById('matchDate').textContent = ` ${formattedDate}`;
        document.getElementById('matchTime').textContent = ` ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;

        const awayTeamName = document.getElementById('awayTeamName');
        const awayTeamLogo = document.getElementById('awayTeamLogo');
        awayTeamName.textContent = event.away_team;

        // LOGICA PER IL LOGO JUVENTUS (BIANCO SUL SITO)
        if (event.away_team.toLowerCase() === 'juventus') {
            // Juventus: usa logo bianco sul sito
            awayTeamLogo.src = '/logos/juventus-white.png';
            awayTeamLogo.style.width = '80px';
            awayTeamLogo.style.height = '80px';
            awayTeamLogo.style.objectFit = 'contain';
            awayTeamLogo.style.display = 'block';
        } else if (event.away_logo) {
            // Altre squadre con logo nel database
            awayTeamLogo.src = event.away_logo;
            awayTeamLogo.style.width = '80px';
            awayTeamLogo.style.height = '80px';
            awayTeamLogo.style.objectFit = 'contain';
            awayTeamLogo.style.display = 'block';
        } else {
            // Altre squadre: prova a prenderlo dalla cartella
            const logoName = event.away_team.toLowerCase().replace(/\s/g, '');
            awayTeamLogo.src = `/logos/${logoName}.png`;
        }

        await loadSeats(eventId);

    } catch (error) {
        console.error('Error loading match details:', error);
    }
}

// Load seats for specific event
async function loadSeats(eventId) {
    try {
        const response = await fetch(`/api/seats/${eventId}`);
        seatsData = await response.json();
        renderSeats();
    } catch (error) {
        console.error('Error loading seats:', error);
    }
}

// Initialize WebSocket connection
function initWebSocket() {
    ws = new WebSocket(`ws://${window.location.host}`);

    ws.onopen = () => {
        console.log('WebSocket connected');
        ws.send(JSON.stringify({
            type: 'auth',
            userId: currentUser.id
        }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
        setTimeout(initWebSocket, 3000);
    };
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'seat_update':
            updateSeatStatus(data.seatId, data.status, data.userId);
            break;
        case 'lock_success':
            showNotification('Posto bloccato con successo! Hai 60 secondi per completare.', 'success');
            break;
        case 'lock_failed':
            showNotification('Impossibile bloccare il posto. Riprova con un altro posto.', 'error');
            break;
        case 'price_update':
            console.log(`💰 Prezzo aggiornato: ${data.sector} -> €${data.newPrice}`);
            // Se la partita corrente è quella aggiornata, ricarica i posti
            if (currentEventId == data.eventId) {
                loadSeats(currentEventId);
                showNotification(`I prezzi del settore ${data.sector} sono stati aggiornati!`, 'info');
            }
            break;
        // Puoi aggiungere altri case qui se necessario
    }
}
// Render seats by sector
function renderSeats() {
    const container = document.getElementById('seatsContainer');
    const sectors = groupBySector(seatsData);

    if (Object.keys(sectors).length === 0) {
        container.innerHTML = '<div class="loading">Nessun posto disponibile per questa partita</div>';
        return;
    }

    container.innerHTML = '';

    // Mappa dei colori per il nome del settore (solo testo)
    const sectorTitleColors = {
        'Curva Nord': '#15b410',        
        'Curva Sud': '#02409e',       
        'Poltroncina Rossa (N-T)': '#d60c0c', 
        'Tribuna Ovest': '#d60c0c',
        'VIP Hospitality': '#d60c0c',
        'Tribuna Est': '#ec8907'
        
    };

    for (const [sectorName, seats] of Object.entries(sectors)) {
        const sectorDiv = document.createElement('div');
        sectorDiv.className = 'sector';

        // Applica il colore al titolo del settore
        const titleColor = sectorTitleColors[sectorName] || '#667eea'; // colore di default
        sectorDiv.innerHTML = `
            <h3 style="color: ${titleColor};">${sectorName}</h3>
            <div class="seats-grid" id="sector-${sectorName.replace(/\s/g, '')}"></div>
        `;

        container.appendChild(sectorDiv);

        const gridDiv = sectorDiv.querySelector('.seats-grid');
        seats.forEach(seat => {
            const seatDiv = document.createElement('div');
            seatDiv.className = `seat ${seat.status}`;
            if (selectedSeats.includes(seat.id)) {
                seatDiv.classList.add('selected');
            }
            seatDiv.textContent = seat.seat_number;
            seatDiv.onclick = () => selectSeat(seat);
            gridDiv.appendChild(seatDiv);
        });
    }
}

// Group seats by sector
function groupBySector(seats) {
    return seats.reduce((groups, seat) => {
        if (!groups[seat.sector]) {
            groups[seat.sector] = [];
        }
        groups[seat.sector].push(seat);
        return groups;
    }, {});
}

// Update seat status in UI
function updateSeatStatus(seatId, status, userId) {
    const seatIndex = seatsData.findIndex(s => s.id === seatId);
    if (seatIndex !== -1) {
        seatsData[seatIndex].status = status;
        if (status === 'locked' && userId !== currentUser.id) {
            const seat = seatsData[seatIndex];
            showNotification(`Il posto ${seat.seat_number} è stato bloccato da un altro utente`, 'warning');
        }
        renderSeats();
    }
}

// Select seat
async function selectSeat(seat) {
    if (!currentEventId) {
        showNotification('Seleziona prima una partita', 'error');
        return;
    }

    if (seat.status === 'booked') {
        showNotification('Questo posto è già stato prenotato', 'error');
        return;
    }

    if (seat.status === 'locked' && seat.locked_by !== currentUser.id) {
        showNotification('Questo posto è bloccato da un altro utente', 'error');
        return;
    }

    if (selectedSeats.includes(seat.id)) {
        selectedSeats = selectedSeats.filter(id => id !== seat.id);
        await unlockSeat(seat.id);
    } else {
        if (selectedSeats.length >= 4) {
            showNotification('Massimo 4 posti per prenotazione', 'error');
            return;
        }

        selectedSeats.push(seat.id);
        await lockSeat(seat.id);
    }

    updateSelectedSeatsList();
}

// Lock seat via WebSocket
async function lockSeat(seatId) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'lock_seat',
            seatId: seatId,
            eventId: currentEventId,
            userId: currentUser.id
        }));
    }
}

// Unlock seat via WebSocket
async function unlockSeat(seatId) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'unlock_seat',
            seatId: seatId,
            userId: currentUser.id
        }));
    }
}

// Update selected seats list
function updateSelectedSeatsList() {
    const listContainer = document.getElementById('selectedSeatsList');
    const totalPriceSpan = document.getElementById('totalPrice');
    const proceedBtn = document.getElementById('proceedToPayment');

    if (selectedSeats.length === 0) {
        listContainer.innerHTML = '<p class="empty-message">Nessun posto selezionato</p>';
        totalPriceSpan.textContent = '€0';
        proceedBtn.disabled = true;
        return;
    }

    const selectedSeatsData = seatsData.filter(seat => selectedSeats.includes(seat.id));
    const total = selectedSeatsData.reduce((sum, seat) => sum + seat.price, 0);

    listContainer.innerHTML = selectedSeatsData.map(seat => `
        <div class="selected-seat-item">
            <span>${seat.seat_number}</span>
            <span>€${seat.price}</span>
            <button onclick="removeSeat(${seat.id})" class="remove-seat">Rimuovi</button>
        </div>
    `).join('');

    totalPriceSpan.textContent = `€${total}`;
    proceedBtn.disabled = false;
}

// Remove seat
window.removeSeat = async function (seatId) {
    selectedSeats = selectedSeats.filter(id => id !== seatId);
    await unlockSeat(seatId);
    updateSelectedSeatsList();
};

// Proceed to payment
async function proceedToPayment() {
    if (selectedSeats.length === 0) return;
    if (!currentEventId) {
        showNotification('Errore: partita non selezionata', 'error');
        return;
    }

    const selectedSeatsData = seatsData.filter(seat => selectedSeats.includes(seat.id));
    const totalAmount = selectedSeatsData.reduce((sum, seat) => sum + seat.price, 0);

    try {
        const response = await fetch('/api/create-booking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                userId: currentUser.id,
                eventId: currentEventId,
                seatIds: selectedSeats,
                totalAmount: totalAmount
            })
        });

        const data = await response.json();
        console.log('📦 Risposta create-booking:', data);

        if (data.success) {
            // USA data.bookingId (non data.bookingCode)
            localStorage.setItem('currentBooking', JSON.stringify({
                bookingId: data.bookingId,
                bookingCode: data.bookingCode,
                seats: selectedSeatsData,
                totalAmount: totalAmount,
                expiresAt: data.expiresAt,
                eventId: currentEventId
            }));

            window.location.href = 'payment.html';
        } else {
            showNotification('Errore: ' + (data.message || 'Creazione prenotazione fallita'), 'error');
        }
    } catch (error) {
        console.error('Error creating booking:', error);
        showNotification('Errore del server', 'error');
    }
}
// Show notification
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#ff9800'};
        color: white;
        border-radius: 8px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Logout
function logout() {
    stopInactivityTracking(); // Ferma il timer di inattività
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (ws) {
        ws.close();
    }
    window.location.href = 'login.html';
}

// Load user bookings
async function loadUserBookings() {
    try {
        // PULISCI LE PRENOTAZIONI SCADUTE PRIMA DI MOSTRARE LA LISTA
        await fetch('/api/clean-expired-bookings', { method: 'POST' });
        
        const response = await fetch(`/api/user-bookings/${currentUser.id}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const bookings = await response.json();
        showBookingsModal(bookings);
    } catch (error) {
        console.error('Error loading bookings:', error);
    }
}

// Show bookings modal
function showBookingsModal(bookings) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        backdrop-filter: blur(4px);
    `;

    modal.innerHTML = `
        <div style="background: white; border-radius: 24px; padding: 30px; max-width: 650px; max-height: 80vh; overflow-y: auto; width: 90%;">
            <h2 style="margin-bottom: 20px;">Le mie prenotazioni</h2>
            ${bookings.length === 0 ? '<p>Nessuna prenotazione trovata</p>' : bookings.map(booking => `
                <div style="border: 1px solid #e0e0e0; border-radius: 16px; padding: 15px; margin-bottom: 15px;">
                    <strong>Codice:</strong> ${booking.booking_code}<br>
                    <strong>Partita:</strong> ${booking.home_team} vs ${booking.away_team}<br>
                    <strong>Posto:</strong> ${booking.seat_number}<br>
                    <strong>Settore:</strong> ${booking.sector}<br>
                    <strong>Stato:</strong> ${booking.payment_status === 'completed' ? '✅ Confermato' : '⏳ In attesa di pagamento'}<br>
                    <strong>Data:</strong> ${new Date(booking.created_at).toLocaleString('it-IT')}
                    <div style="margin-top: 12px; display: flex; gap: 10px; justify-content: flex-end;">
                        ${booking.payment_status !== 'completed' ? `
                            <button class="btn-pay-booking" data-code="${booking.booking_code}" style="background: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer;">💰 Paga ora</button>
                            <button class="btn-cancel-booking" data-code="${booking.booking_code}" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer;">🗑️ Cancella</button>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
            <button id="closeModalBtn" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">Chiudi</button>
        </div>
    `;

    document.body.appendChild(modal);
    
    // Paga ora
    document.querySelectorAll('.btn-pay-booking').forEach(btn => {
        btn.addEventListener('click', async () => {
            const bookingCode = btn.getAttribute('data-code');
            showNotification('Recupero dati prenotazione...', 'success');
            
            try {
                const response = await fetch(`/api/booking/pay/${bookingCode}`, { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id })
                });
                const data = await response.json();
                
                if (data.success) {
                    // Salva i dati per il pagamento
                    localStorage.setItem('currentBooking', JSON.stringify({
                        bookingId: data.paymentData.bookingId,
                        seats: data.paymentData.seats,
                        totalAmount: data.paymentData.totalAmount,
                        expiresAt: data.paymentData.expiresAt,
                        eventId: data.paymentData.eventId
                    }));
                    window.location.href = 'payment.html';
                } else {
                    showNotification(data.message, 'error');
                }
            } catch (error) {
                showNotification('Errore nel recupero della prenotazione', 'error');
            }
        });
    });
    
    // Cancella prenotazione
    document.querySelectorAll('.btn-cancel-booking').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('Sei sicuro di voler cancellare questa prenotazione? I posti torneranno disponibili.')) {
                const bookingCode = btn.getAttribute('data-code');
                try {
                    const response = await fetch(`/api/booking/${bookingCode}?userId=${currentUser.id}`, { method: 'DELETE' });
                    const data = await response.json();
                    if (data.success) {
                        showNotification('Prenotazione cancellata con successo', 'success');
                        modal.remove();
                        loadUserBookings(); // Ricarica la lista
                    } else {
                        showNotification(data.message, 'error');
                    }
                } catch (error) {
                    showNotification('Errore durante la cancellazione', 'error');
                }
            }
        });
    });
    
    document.getElementById('closeModalBtn').addEventListener('click', () => modal.remove());
}

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;

    initTheme();
    initWebSocket();
    loadMatches();
    startInactivityTracking();

    document.getElementById('proceedToPayment').addEventListener('click', proceedToPayment);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('myBookingsLink').addEventListener('click', (e) => {
        e.preventDefault();
        loadUserBookings();
    });
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
});