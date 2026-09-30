export function initHistoryView() {
    const tableBody = document.getElementById('historyTableBody');
    const filterSelect = document.getElementById('historyFilter');

    if (!tableBody || !filterSelect) return;

    let allHistory = [];

    async function fetchHistory() {
        try {
            // Fetch simulation history via the Electron IPC bridge
            const data = await window.versions.getSimulationHistory();
            console.log('[DEBUG] Raw history fetched from DB via IPC:', data);
            
            const rawArray = Array.isArray(data) ? data : (data.history || []);

            // Normalize fields to match database columns (simulation_type, sub_type, configuration, created_at)
            allHistory = rawArray.map(item => ({
                id: item.id,
                type: item.simulation_type || item.type || 'unknown',
                subType: item.sub_type || item.subType || 'standard',
                configuration: item.configuration || item.config || item,
                timestamp: item.created_at || item.timestamp || new Date().toISOString()
            }));

            console.log('[DEBUG] Normalized history array:', allHistory);
            renderTable(filterSelect.value);
        } catch (err) {
            console.error('Failed to load simulation history:', err);
            tableBody.innerHTML = `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #ef4444;">Failed to load history records.</td></tr>`;
        }
    }

    function renderTable(filter) {
        const filtered = allHistory.filter(item => {
            if (filter === 'all') return true;
            return item.type?.toLowerCase() === filter.toLowerCase() || 
                   item.subType?.toLowerCase() === filter.toLowerCase();
        });

        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #94a3b8;">No records found.</td></tr>`;
            return;
        }

        tableBody.innerHTML = filtered.map(item => `
            <tr style="border-bottom: 1px solid #1e293b; transition: background 0.2s;" onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background='transparent'">
                <td style="padding: 10px 12px; font-family: monospace; color: #38bdf8;">#${item.id || '--'}</td>
                <td style="padding: 10px 12px; font-weight: 500; text-transform: capitalize;">${item.type}</td>
                <td style="padding: 10px 12px; color: #94a3b8; text-transform: capitalize;">${item.subType}</td>
                <td style="padding: 10px 12px; color: #94a3b8;">${new Date(item.timestamp).toLocaleString()}</td>
                <td style="padding: 10px 12px; text-align: right;">
                    <button class="inspect-btn" data-id="${item.id}" style="background: #2563eb; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">View Config</button>
                </td>
            </tr>
        `).join('');

        // Attach listeners to inspect buttons
        tableBody.querySelectorAll('.inspect-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const record = allHistory.find(r => String(r.id) === String(id));
                if (record) {
                    // Open modal or display JSON structure similar to React version
                    console.inspect ? console.inspect(record.configuration) : console.log(record.configuration);
                    alert(`Configuration Payload for #${record.id}:\n\n${JSON.stringify(record.configuration, null, 2)}`);
                }
            });
        });
    }

    filterSelect.addEventListener('change', (e) => {
        renderTable(e.target.value);
    });

    // Initial load
    fetchHistory();
}