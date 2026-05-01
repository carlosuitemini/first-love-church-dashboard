// ================= CONFIGURATION =================
const GOOGLE_SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbyBLNfetfiwsDw9696B6AqO7neyhuGjuO933LZT9fTECXINsSj0t_AGPjsdb-r8yeA3CQ/exec';
const IMGBB_API_KEY = "107609db4a711a802f096fe2de2c3ce8";

// Predefined Leaders List
const LEADERS_BY_GOVERNORSHIP = {
    "Juja Governorship": ["Evans Okumu", "Paul Webi", "Deborah Njorogex", "Friend Mwaura"],
    "Kiriri Governorship": ["Stella Njambi", "Charisma Angel", "Perkins Katisa", "Tanyasis"],
    "KU Governorship": ["Joseph Misunga", "Austin Peter", "Beatrice Mueni", "George Gute", "Omaset Linda", "Edwin Omondi", "Abigail Mbogo"]
};

// All leaders flat list
const ALL_LEADERS = [...LEADERS_BY_GOVERNORSHIP["Juja Governorship"], ...LEADERS_BY_GOVERNORSHIP["Kiriri Governorship"], ...LEADERS_BY_GOVERNORSHIP["KU Governorship"]];

// ================= HELPER FUNCTIONS =================
function getEATTime() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (3 * 3600000));
}

function formatEATDate(date) {
    const d = date || getEATTime();
    return d.toISOString().slice(0, 19).replace('T', ' ');
}

function isSubmissionAllowed(day, startHour, endHour) {
    const now = getEATTime();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    
    if (currentDay !== day) return false;
    return currentHour >= startHour && currentHour < endHour;
}

// ================= IMAGE UPLOAD =================
async function uploadImage(file) {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: "POST",
        body: formData
    });
    const data = await res.json();
    if (!data.success) {
        throw new Error(data.error?.message || "Upload failed");
    }
    return data.data.url;
}

// ================= DATA OPERATIONS (Google Sheets) =================
async function loadData(dashboardType, sheetName) {
    const sheet = sheetName || 'Sheet1';
    const url = `${GOOGLE_SHEETS_API_URL}?action=read&type=${dashboardType}&sheet=${sheet}`;
    
    try {
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            console.log(`Loaded ${result.count} records from ${dashboardType}/${sheet}`);
            return result.data;
        } else {
            console.error("Load data error:", result.error);
            return [];
        }
    } catch (err) {
        console.error("Load data error:", err);
        return [];
    }
}

async function saveData(dashboardType, sheetName, record) {
    const sheet = sheetName || 'Sheet1';
    const params = new URLSearchParams();
    params.append('action', 'write');
    params.append('type', dashboardType);
    params.append('sheet', sheet);
    
    for (let key in record) {
        if (record.hasOwnProperty(key)) {
            params.append(key, record[key]);
        }
    }
    
    const url = `${GOOGLE_SHEETS_API_URL}?${params.toString()}`;
    
    try {
        const response = await fetch(url);
        const result = await response.json();
        return { success: result.success, error: result.error };
    } catch (err) {
        console.error("Save error:", err);
        return { success: false, error: err.message };
    }
}

// ================= LEADER DROPDOWN =================
function createLeaderDropdown(selectedValue = "", onChangeCallback = null) {
    const div = document.createElement('div');
    div.className = 'leader-selector';
    
    const select = document.createElement('select');
    select.id = 'leaderSelect';
    select.required = true;
    
    for (const [governorship, leaders] of Object.entries(LEADERS_BY_GOVERNORSHIP)) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = governorship;
        leaders.forEach(leader => {
            const option = document.createElement('option');
            option.value = leader;
            option.textContent = leader;
            if (leader === selectedValue) option.selected = true;
            optgroup.appendChild(option);
        });
        select.appendChild(optgroup);
    }
    
    const otherOption = document.createElement('option');
    otherOption.value = "other";
    otherOption.textContent = "Other (New Leader)";
    select.appendChild(otherOption);
    
    div.appendChild(select);
    
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.id = 'newLeaderName';
    textInput.placeholder = 'Enter new leader name';
    textInput.style.display = 'none';
    textInput.style.marginTop = '10px';
    div.appendChild(textInput);
    
    select.addEventListener('change', () => {
        if (select.value === 'other') {
            textInput.style.display = 'block';
            textInput.required = true;
            if (onChangeCallback) onChangeCallback('');
        } else {
            textInput.style.display = 'none';
            textInput.required = false;
            textInput.value = '';
            if (onChangeCallback) onChangeCallback(select.value);
        }
    });
    
    return { 
        div, 
        getValue: () => {
            if (select.value === 'other') {
                return textInput.value.trim();
            }
            return select.value;
        }, 
        setValue: (val) => {
            if (ALL_LEADERS.includes(val)) {
                select.value = val;
                textInput.style.display = 'none';
            } else {
                select.value = 'other';
                textInput.style.display = 'block';
                textInput.value = val;
            }
        }
    };
}

// ================= CHART RENDERER =================
let currentChart = null;

function renderChart(data, labelsKey, datasetsConfig, containerId = 'chart') {
    const ctx = document.getElementById(containerId).getContext('2d');
    if (currentChart) currentChart.destroy();
    
    if (!data || data.length === 0) {
        currentChart = new Chart(ctx, { type: 'line', data: { labels: [], datasets: [] } });
        return;
    }
    
    const grouped = {};
    data.forEach(item => {
        const date = item.Timestamp?.split(' ')[0] || item.Timestamp?.split('T')[0];
        if (!grouped[date]) grouped[date] = {};
        datasetsConfig.forEach(cfg => {
            if (!grouped[date][cfg.key]) grouped[date][cfg.key] = 0;
            grouped[date][cfg.key] += item[cfg.key] || 0;
        });
    });
    
    const labels = Object.keys(grouped).sort();
    const datasets = datasetsConfig.map(cfg => ({
        label: cfg.label,
        data: labels.map(l => grouped[l][cfg.key] || 0),
        borderColor: cfg.color,
        backgroundColor: 'transparent',
        tension: 0.2
    }));
    
    currentChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#fff' } } }
        }
    });
}

// ================= EXPORT EXCEL =================
function exportToExcel(data, filename, headers) {
    if (!data || data.length === 0) {
        alert('No data to export!');
        return;
    }
    
    const rows = [headers];
    data.forEach(item => {
        const row = headers.map(header => {
            const value = item[header] || '';
            return value;
        });
        rows.push(row);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${filename}_${formatEATDate().slice(0,10)}.xlsx`);
}

// ================= PASSWORD PROTECTION =================
function checkPassword(expectedPassword, redirectUrl) {
    const password = prompt("Enter password to access this dashboard:");
    if (password === expectedPassword) {
        window.location.href = redirectUrl;
    } else {
        alert("Incorrect password!");
        window.location.href = "index.html";
    }
}

console.log('script.js loaded with Google Sheets API');