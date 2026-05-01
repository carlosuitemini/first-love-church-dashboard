// ================= FLC DATABASE CONNECTOR =================

const FLC_API_URL = 'https://script.google.com/macros/s/AKfycbyBLNfetfiwsDw9696B6AqO7neyhuGjuO933LZT9fTECXINsSj0t_AGPjsdb-r8yeA3CQ/exec';

async function loadData(dashboardType, sheetName) {
    try {
        const sheet = sheetName || 'Sheet1';
        const url = FLC_API_URL + '?action=read&type=' + dashboardType + '&sheet=' + sheet;
        console.log('Fetching:', url);
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            console.log('Loaded', result.count, 'records from', dashboardType, sheet);
            return result.data;
        } else {
            console.error('Load failed:', result.error);
            return [];
        }
    } catch (error) {
        console.error('Network error:', error);
        return [];
    }
}

async function saveData(record, dashboardType, sheetName) {
    try {
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
        
        const url = FLC_API_URL + '?' + params.toString();
        const response = await fetch(url);
        const result = await response.json();
        
        return { success: result.success, error: result.error };
    } catch (error) {
        console.error('Network error:', error);
        return { success: false, error: error.message };
    }
}

async function testConnection() {
    console.log('Testing connection to Google Sheets...');
    const data = await loadData('bacenta', 'Sheet1');
    
    if (data && Array.isArray(data)) {
        console.log('Connection successful! Found', data.length, 'records in Bacenta sheet');
        return true;
    } else {
        console.error('Connection failed');
        return false;
    }
}

window.FLC_DB = {
    loadData: loadData,
    saveData: saveData,
    testConnection: testConnection,
    API_URL: FLC_API_URL
};

console.log('FLC Database connector loaded with URL:', FLC_API_URL);