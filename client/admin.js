let currentUser = null;
let eventsList = [];
let adminWs = null;
let onlineUsers = [];
let charts = {}; // Per i grafici Chart.js

// ============ ADMIN WEBSOCKET ============

function initAdminWebSocket() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
adminWs = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`);
    
    adminWs.onopen = () => {
        console.log('🔌 Admin WebSocket connected');
        const user = JSON.parse(localStorage.getItem('user'));
        adminWs.send(JSON.stringify({
            type: 'auth',
            userId: user.id
        }));
    };
    
    adminWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'online_users_update') {
            onlineUsers = data.users;
            renderOnlineUsers(data.users, data.count);
        }
    };
    
    adminWs.onerror = (error) => {
        console.error('Admin WebSocket error:', error);
    };
    
    adminWs.onclose = () => {
        console.log('Admin WebSocket disconnected, reconnecting...');
        setTimeout(initAdminWebSocket, 3000);
    };
}

// Ping periodico per mantenere la connessione attiva
setInterval(() => {
    if (adminWs && adminWs.readyState === WebSocket.OPEN) {
        adminWs.send(JSON.stringify({ type: 'ping' }));
    }
}, 25000);

function renderOnlineUsers(users, count) {
    const container = document.getElementById('onlineUsersContainer');
    if (!container) return;
    
    if (users.length === 0) {
        container.innerHTML = '<p>📭 Nessun utente collegato al momento</p>';
        return;
    }
    
    const usersHtml = `
        <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px;">
            ${users.map(user => `
                <div style="background: white; border-radius: 12px; padding: 12px 20px; border-left: 4px solid #28a745; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <strong>👤 ${escapeHtml(user.username)}</strong><br>
                    <small style="color: #666;">ID: ${user.userId}</small><br>
                    <small style="color: #999;">Ultima attività: ${new Date(user.lastActivity).toLocaleTimeString('it-IT')}</small>
                </div>
            `).join('')}
        </div>
        <div style="padding: 10px; background: #e8f5e9; border-radius: 12px;">
            <strong>Totale utenti collegati: ${count}</strong>
        </div>
    `;
    
    container.innerHTML = usersHtml;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ VERIFICA ADMIN ============

async function checkAdminAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        window.location.href = 'login.html';
        return false;
    }
    
    currentUser = JSON.parse(user);
    document.getElementById('adminName').textContent = currentUser.username;
    
    try {
        const response = await fetch('/api/admin/verify', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (!data.isAdmin) {
            alert('Accesso negato: area riservata agli amministratori');
            window.location.href = 'index.html';
            return false;
        }
        return true;
    } catch (error) {
        console.error('Errore verifica admin:', error);
        window.location.href = 'login.html';
        return false;
    }
}

// ============ BIGLIETTI VENDUTI ============

async function loadTicketsSold() {
    const token = localStorage.getItem('token');
    const eventId = document.getElementById('filterEvent')?.value || '';
    const startDate = document.getElementById('filterStartDate')?.value || '';
    const endDate = document.getElementById('filterEndDate')?.value || '';
    
    let url = '/api/admin/tickets-sold';
    const params = new URLSearchParams();
    if (eventId) params.append('eventId', eventId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (params.toString()) url += '?' + params.toString();
    
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            eventsList = data.events;
            renderTicketsTable(data.tickets);
            renderStats(data.tickets);
        } else {
            document.getElementById('adminContent').innerHTML = '<div class="admin-dashboard"><p>Errore nel caricamento dei biglietti</p></div>';
        }
    } catch (error) {
        console.error('Errore:', error);
        document.getElementById('adminContent').innerHTML = '<div class="admin-dashboard"><p>Errore di connessione</p></div>';
    }
}

function renderStats(tickets) {
    const totalTickets = tickets.length;
    const totalRevenue = tickets.reduce((sum, t) => sum + t.price, 0);
    
    const statsHtml = `
        <div class="stats">
            <div class="stat-card">
                <h3>${totalTickets}</h3>
                <p>Biglietti venduti</p>
            </div>
            <div class="stat-card">
                <h3>€${totalRevenue.toFixed(2)}</h3>
                <p>Incasso totale</p>
            </div>
        </div>
    `;
    
    const existingStats = document.querySelector('.stats');
    if (existingStats) existingStats.remove();
    
    const filtersDiv = document.querySelector('.filters');
    if (filtersDiv) {
        filtersDiv.insertAdjacentHTML('afterend', statsHtml);
    }
}

function renderTicketsTable(tickets) {
    const eventsOptions = eventsList.map(e => 
        `<option value="${e.id}">${e.home_team} vs ${e.away_team} - ${new Date(e.date).toLocaleDateString('it-IT')}</option>`
    ).join('');
    
    const filtersHtml = `
        <div class="filters">
            <div class="filter-group">
                <label>Partita</label>
                <select id="filterEvent">
                    <option value="">Tutte</option>
                    ${eventsOptions}
                </select>
            </div>
            <div class="filter-group">
                <label>Dal</label>
                <input type="date" id="filterStartDate">
            </div>
            <div class="filter-group">
                <label>Al</label>
                <input type="date" id="filterEndDate">
            </div>
            <div class="filter-group">
                <button class="btn-filter" id="applyFilters">Filtra</button>
            </div>
            <div class="filter-group">
                <button class="btn-filter" id="resetFilters" style="background:#6c757d;">Reset</button>
            </div>
        </div>
    `;
    
    if (tickets.length === 0) {
        document.getElementById('adminContent').innerHTML = `
            <div class="admin-dashboard">
                ${filtersHtml}
                <div class="stats" style="display:none;"></div>
                <p>Nessun biglietto venduto trovato.</p>
            </div>
        `;
    } else {
        const tableRows = tickets.map(ticket => `
            <tr>
                <td>${new Date(ticket.created_at).toLocaleDateString('it-IT')}</td>
                <td>${ticket.home_team} vs ${ticket.away_team}</td>
                <td>${ticket.seat_number}</td>
                <td>${ticket.sector}</td>
                <td>€${ticket.price}</td>
                <td>${ticket.username}</td>
                <td>${ticket.email}</td>
            </tr>
        `).join('');
        
        document.getElementById('adminContent').innerHTML = `
            <div class="admin-dashboard">
                ${filtersHtml}
                <div class="stats"></div>
                <table class="tickets-table">
                    <thead>
                        <tr>
                            <th>Data acquisto</th>
                            <th>Partita</th>
                            <th>Posto</th>
                            <th>Settore</th>
                            <th>Prezzo</th>
                            <th>Utente</th>
                            <th>Email</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    document.getElementById('applyFilters')?.addEventListener('click', loadTicketsSold);
    document.getElementById('resetFilters')?.addEventListener('click', () => {
        document.getElementById('filterEvent').value = '';
        document.getElementById('filterStartDate').value = '';
        document.getElementById('filterEndDate').value = '';
        loadTicketsSold();
    });
    
    renderStats(tickets);
}

// ============ GESTIONE PREZZI ============

async function loadEventsForPriceSelect() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/api/events', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const events = await response.json();
        const select = document.getElementById('priceEventSelect');
        if (select) {
            select.innerHTML = '<option value="">Seleziona una partita</option>' + 
                events.map(e => `<option value="${e.id}">${e.home_team} vs ${e.away_team} - ${new Date(e.date).toLocaleDateString('it-IT')}</option>`).join('');
        }
    } catch (error) {
        console.error('Errore caricamento eventi:', error);
    }
}

async function loadSectorsForEvent(eventId) {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`/api/admin/sectors/${eventId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            const sectorSelect = document.getElementById('sectorSelect');
            sectorSelect.innerHTML = '<option value="">Seleziona un settore</option>' + 
                data.sectors.map(s => `<option value="${s.sector}" data-price="${s.price}">${s.sector} (€${s.price})</option>`).join('');
            
            sectorSelect.onchange = () => {
                const selected = sectorSelect.options[sectorSelect.selectedIndex];
                const currentPrice = selected.getAttribute('data-price');
                if (currentPrice) {
                    document.getElementById('newPrice').value = currentPrice;
                }
            };
        }
    } catch (error) {
        console.error('Errore caricamento settori:', error);
    }
}

async function updatePrice() {
    const eventId = document.getElementById('priceEventSelect').value;
    const sector = document.getElementById('sectorSelect').value;
    const newPrice = document.getElementById('newPrice').value;
    const messageDiv = document.getElementById('priceUpdateMessage');
    
    if (!eventId || !sector || !newPrice) {
        messageDiv.innerHTML = '<span style="color: red;">Compila tutti i campi</span>';
        setTimeout(() => messageDiv.innerHTML = '', 3000);
        return;
    }
    
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/api/admin/update-price', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ eventId, sector, newPrice: parseFloat(newPrice) })
        });
        const data = await response.json();
        
        if (data.success) {
            messageDiv.innerHTML = `<span style="color: green;">✅ ${data.message}</span>`;
            loadSectorsForEvent(eventId);
        } else {
            messageDiv.innerHTML = `<span style="color: red;">❌ Errore: ${data.message}</span>`;
        }
        setTimeout(() => messageDiv.innerHTML = '', 3000);
    } catch (error) {
        messageDiv.innerHTML = '<span style="color: red;">❌ Errore di connessione</span>';
        setTimeout(() => messageDiv.innerHTML = '', 3000);
    }
}

// ============ DASHBOARD STATISTICHE ============

async function loadDashboardStats() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/api/admin/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success && data.ticketsPerMatch) {
            renderCharts(data);
        }
    } catch (error) {
        console.error('Errore caricamento statistiche:', error);
    }
}

function renderCharts(data) {
    // Grafico biglietti per partita
    const ctx1 = document.getElementById('ticketsPerMatchChart');
    if (ctx1 && data.ticketsPerMatch && data.ticketsPerMatch.length > 0) {
        if (charts.ticketsPerMatch) charts.ticketsPerMatch.destroy();
        charts.ticketsPerMatch = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: data.ticketsPerMatch.map(m => `${m.home_team} vs ${m.away_team}`),
                datasets: [{
                    label: 'Biglietti venduti',
                    data: data.ticketsPerMatch.map(m => m.count),
                    backgroundColor: '#667eea',
                    borderRadius: 8
                }]
            },
            options: { responsive: true }
        });
    }
    
    // Grafico andamento vendite
    const ctx2 = document.getElementById('salesTrendChart');
    if (ctx2 && data.salesTrend && data.salesTrend.length > 0) {
        if (charts.salesTrend) charts.salesTrend.destroy();
        charts.salesTrend = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: data.salesTrend.map(t => t.month),
                datasets: [{
                    label: 'Biglietti venduti',
                    data: data.salesTrend.map(t => t.count),
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40,167,69,0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: { responsive: true }
        });
    }
    
    // Grafico settori più richiesti
    const ctx3 = document.getElementById('popularSectorsChart');
    if (ctx3 && data.popularSectors && data.popularSectors.length > 0) {
        if (charts.popularSectors) charts.popularSectors.destroy();
        charts.popularSectors = new Chart(ctx3, {
            type: 'pie',
            data: {
                labels: data.popularSectors.map(s => s.sector),
                datasets: [{
                    data: data.popularSectors.map(s => s.count),
                    backgroundColor: ['#667eea', '#764ba2', '#28a745', '#ffc107', '#dc3545']
                }]
            },
            options: { responsive: true }
        });
    }
}

// ============ INIT ============

document.addEventListener('DOMContentLoaded', async () => {
    if (!await checkAdminAuth()) return;
    
    initAdminWebSocket();
    
    document.getElementById('adminContent').innerHTML = '<div class="admin-dashboard"><p>Caricamento biglietti venduti...</p></div>';
    
    await loadTicketsSold();
    await loadEventsForPriceSelect();
    await loadDashboardStats();
    
    document.getElementById('priceEventSelect')?.addEventListener('change', (e) => {
        if (e.target.value) {
            loadSectorsForEvent(e.target.value);
        }
    });
    
    document.getElementById('updatePriceBtn')?.addEventListener('click', updatePrice);
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (adminWs) adminWs.close();
        localStorage.clear();
        window.location.href = 'login.html';
    });
    
    document.getElementById('refreshBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        loadTicketsSold();
    });
});
