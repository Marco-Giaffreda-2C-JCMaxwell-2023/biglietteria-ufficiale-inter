// Applica il tema salvato anche nella ricevuta
function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}

applySavedTheme();

// Variabile globale per salvare il nome della squadra avversaria
let awayTeamName = '';

// Funzione per aggiornare il logo in base al contesto
function updateOpponentLogo() {
    const opponentImg = document.getElementById('opponentLogoImg');
    if (!opponentImg || !awayTeamName) return;
    
    const isLightTheme = document.body.classList.contains('light-theme');
    const isPrinting = window.matchMedia('print').matches;
    
    if (awayTeamName.toLowerCase() === 'juventus') {
        if (isPrinting) {
            // In stampa: usa SEMPRE il logo nero
            opponentImg.src = '/logos/juventus.png';
        } else if (isLightTheme) {
            // Tema chiaro a schermo: logo nero
            opponentImg.src = '/logos/juventus.png';
        } else {
            // Tema scuro a schermo: logo bianco
            opponentImg.src = '/logos/juventus-white.png';
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const lastBooking = localStorage.getItem('lastBooking');
    
    if (!lastBooking) {
        window.location.href = 'index.html';
        return;
    }
    
    const booking = JSON.parse(lastBooking);
    
    document.getElementById('bookingCode').textContent = booking.bookingCode;
    
    let eventDetails = '';
    let logosHtml = '';
    let paymentMethodText = '';
    
    // Rileva tema corrente
    const isLightTheme = document.body.classList.contains('light-theme');
    const isPrinting = window.matchMedia('print').matches;
    
    try {
        const response = await fetch(`/api/events/${booking.eventId}`);
        const event = await response.json();
        const date = new Date(event.date);
        awayTeamName = event.away_team;
        
        if (booking.paymentMethod === 'credit_card') {
            paymentMethodText = 'Carta di Credito';
        } else if (booking.paymentMethod === 'paypal') {
            paymentMethodText = 'PayPal';
        } else {
            paymentMethodText = booking.paymentMethod || 'Non specificato';
        }
        
        eventDetails = `
            <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #e0e0e0;">
                <strong>Partita:</strong> ${event.home_team} vs ${event.away_team}<br>
                <strong>Data:</strong> ${date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}<br>
                <strong>Orario:</strong> ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}<br>
                <strong>Stadio:</strong> Giuseppe Meazza<br>
                <strong>Metodo di pagamento:</strong> ${paymentMethodText}
            </div>
        `;
        
        const interLogo = '/logos/inter.png';
        
        // Scegli il logo iniziale per la squadra avversaria
        let opponentLogo = `/logos/${event.away_team.toLowerCase().replace(/\s/g, '')}.png`;
        
        if (event.away_team.toLowerCase() === 'juventus') {
            if (isPrinting) {
                opponentLogo = '/logos/juventus.png';
            } else if (isLightTheme) {
                opponentLogo = '/logos/juventus.png';
            } else {
                opponentLogo = '/logos/juventus-white.png';
            }
        }
        
        logosHtml = `
            <div id="logosWrapper">
                <div>
                    <img src="${interLogo}" alt="Inter">
                    <div>INTER</div>
                </div>
                <div>VS</div>
                <div>
                    <img id="opponentLogoImg" src="${opponentLogo}" alt="${event.away_team}">
                    <div>${event.away_team.toUpperCase()}</div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Errore nel caricamento evento:', error);
        paymentMethodText = booking.paymentMethod === 'credit_card' ? 'Carta di Credito' : (booking.paymentMethod === 'paypal' ? 'PayPal' : 'Non specificato');
        eventDetails = `
            <div style="margin-bottom: 15px;">
                <strong>Evento:</strong> Inter vs Opponent<br>
                <strong>Stadio:</strong> Giuseppe Meazza<br>
                <strong>Metodo di pagamento:</strong> ${paymentMethodText}
            </div>
        `;
        logosHtml = `
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="/logos/inter.png" alt="Inter Milan" style="width: 80px; height: auto; display: block; margin: 0 auto;">
                <h3 style="margin-top: 8px;">Stadio Giuseppe Meazza</h3>
            </div>
        `;
    }
    
    let discountHtml = '';
    if (booking.discountApplied && booking.discountAmount > 0) {
        const savedAmount = booking.originalTotal - booking.totalAmount;
        discountHtml = `
            <div style="margin-top: 10px; padding: 10px; border-radius: 8px; background: var(--surface);">
                <strong>Sconto applicato:</strong> ${booking.discountAmount}%<br>
                <strong>Risparmiato:</strong> €${savedAmount.toFixed(2)}
            </div>
        `;
    }
    
    const ticketDetailsDiv = document.getElementById('ticketDetails');
    ticketDetailsDiv.innerHTML = `
        ${logosHtml}
        ${eventDetails}
        ${booking.seats.map(seat => `
            <div style="margin-bottom: 10px; padding: 10px; border-radius: 8px; background: var(--surface);">
                <strong>Posto:</strong> ${seat.seat_number}<br>
                <strong>Settore:</strong> ${seat.sector}<br>
                <strong>Prezzo:</strong> €${seat.price}
            </div>
        `).join('')}
        <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid var(--border);">
            <strong>Totale originale:</strong> €${booking.originalTotal.toFixed(2)}<br>
            <strong>Totale pagato:</strong> €${booking.totalAmount.toFixed(2)}
        </div>
        ${discountHtml}
    `;
    
    // GESTIONE STAMPA: aggiorna il logo quando si stampa
    window.addEventListener('beforeprint', () => {
        updateOpponentLogo();
    });
    
    // Pulisci il localStorage
    localStorage.removeItem('currentBooking');
});