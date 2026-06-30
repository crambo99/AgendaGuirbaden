document.addEventListener('DOMContentLoaded', () => {
    const syncStatus = document.getElementById('sync-status');
    const headerRow1 = document.getElementById('header-row-1');
    const headerRow2 = document.getElementById('header-row-2');
    const tableBody = document.getElementById('table-body');
    const monthPicker = document.getElementById('month-picker');

    let presenceData = {};
    let users = [];
    let dates = [];
    let database = null;

    const firebaseConfig = {
        apiKey: "AIzaSyBHT1mdJvnJxq7lf5jw3uvyODD0cbG8Oxc",
        authDomain: "agendaguirbaden.firebaseapp.com",
        projectId: "agendaguirbaden",
        storageBucket: "agendaguirbaden.appspot.com",
        messagingSenderId: "739762268039",
        appId: "1:739762268039:web:a25255a3b95110c3e75522",
        databaseURL: "https://agendaguirbaden-default-rtdb.europe-west1.firebasedatabase.app"
    };

    const getMonthKey = (year, month) => `${year}-${String(month + 1).padStart(2, '0')}`;

    const formatMonthValue = (year, month) => `${year}-${String(month + 1).padStart(2, '0')}`;

    const changeMonthValue = (value, delta) => {
        const [year, month] = value.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        date.setMonth(date.getMonth() + delta);
        return formatMonthValue(date.getFullYear(), date.getMonth());
    };

    const formatDate = (date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    };

    const formatDateKey = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const parseDateString = (dateString) => {
        const datePart = dateString.split('T')[0];
        const [year, month, day] = datePart.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    const getDayName = (date) => {
        const days = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
        return days[date.getDay()];
    };

    const getMonthDates = (year, month) => {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const monthDates = [];

        for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            if (dayOfWeek === 1 || dayOfWeek === 6) {
                monthDates.push(new Date(d));
            }
        }
        return monthDates;
    };

    const getCurrentMonthValue = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    };

    const parseMonthValue = (value) => {
        const [year, month] = value.split('-').map(Number);
        return { year, month: month - 1 };
    };

    const renderHeader = () => {
        let header1Html = '<th class="user-column">Utilisateurs</th>';
        dates.forEach(date => {
            const dateDisplay = formatDate(date);
            const dayName = getDayName(date);
            header1Html += `
                <th class="date-header" colspan="2">
                    <div class="date-info">${dateDisplay} <br><small>${dayName}</small></div>
                </th>
            `;
        });
        headerRow1.innerHTML = header1Html;

        let header2Html = '<th class="user-column"></th>';
        dates.forEach(() => {
            header2Html += '<th class="shift-header">Matin</th><th class="shift-header">Après<br/>Midi</th>';
        });
        headerRow2.innerHTML = header2Html;
    };

    const getStatusSymbol = (status) => {
        switch (status) {
            case 'present': return '✓';
            case 'maybe': return '?';
            case 'absent':
            default: return '✗';
        }
    };

    const userStorageKey = (user) => {
        const key = String(user).replace(/[.#$\/\[\]]/g, (c) => `_${c.charCodeAt(0)}_`);
        return key || '_empty_user_';
    };

    const getTotalCounts = (dateKey, shift) => {
        return users.reduce((totals, user) => {
            const storageKey = userStorageKey(user);
            const key = `${dateKey}-${shift}`;
            const status = presenceData[storageKey] ? presenceData[storageKey][key] : 'absent';
            if (status === 'present') totals.present += 1;
            if (status === 'maybe') totals.maybe += 1;
            return totals;
        }, { present: 0, maybe: 0 });
    };

    const toggleCell = (e) => {
        const cell = e.target;
        const user = cell.dataset.user;
        const storageUser = userStorageKey(user);
        const date = cell.dataset.date;
        const shift = cell.dataset.shift;
        const key = `${date}-${shift}`;

        if (!presenceData[storageUser]) {
            presenceData[storageUser] = {};
        }

        let currentStatus = presenceData[storageUser][key] || 'absent';
        let newStatus;
        switch (currentStatus) {
            case 'absent': newStatus = 'present'; break;
            case 'present': newStatus = 'maybe'; break;
            case 'maybe': newStatus = 'absent'; break;
            default: newStatus = 'present';
        }

        presenceData[storageUser][key] = newStatus;
        cell.className = `cell status-${newStatus}`;
        cell.textContent = getStatusSymbol(newStatus);

        renderTable();
        savePresenceData();
    };

    const renderTotalRow = () => {
        let html = '<th class="user-column">Total présents</th>';

        dates.forEach(date => {
            const dateKey = formatDateKey(date);
            const matinCounts = getTotalCounts(dateKey, 'matin');
            const apresCounts = getTotalCounts(dateKey, 'apres');
            const matinLabel = matinCounts.present + (matinCounts.maybe ? ` (${matinCounts.maybe})` : '');
            const apresLabel = apresCounts.present + (apresCounts.maybe ? ` (${apresCounts.maybe})` : '');
            html += `
                <th class="total-cell">${matinLabel}</th>
                <th class="total-cell">${apresLabel}</th>
            `;
        });

        return html;
    };

    const renderTable = () => {
        renderHeader();
        document.getElementById('header-row-3').innerHTML = renderTotalRow();
        tableBody.innerHTML = '';

        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `<td class="user-name">${user}</td>`;

            dates.forEach(date => {
                const dateKey = formatDateKey(date);
                const matinKey = `${dateKey}-matin`;
                const apresKey = `${dateKey}-apres`;

                const storageKey = userStorageKey(user);
                if (!presenceData[storageKey]) {
                    presenceData[storageKey] = {};
                }

                const matinStatus = presenceData[storageKey][matinKey] || 'absent';
                const apresStatus = presenceData[storageKey][apresKey] || 'absent';

                row.innerHTML += `
                    <td class="cell status-${matinStatus}" data-user="${user}" data-date="${dateKey}" data-shift="matin">
                        ${getStatusSymbol(matinStatus)}
                    </td>
                    <td class="cell status-${apresStatus}" data-user="${user}" data-date="${dateKey}" data-shift="apres">
                        ${getStatusSymbol(apresStatus)}
                    </td>
                `;
            });

            tableBody.appendChild(row);
        });

        document.querySelectorAll('.cell').forEach(cell => {
            cell.addEventListener('click', toggleCell);
        });
    };

    const loadUsers = async () => {
        const ref = firebase.database().ref('users');
        const snapshot = await ref.once('value');
        const result = snapshot.val();
        users = Array.isArray(result) ? result.filter(Boolean) : (result ? Object.values(result) : []);
        users.sort();
    };

    const loadDatesForMonth = async (monthKey) => {
        const ref = firebase.database().ref(`datesByMonth/${monthKey}`);
        const snapshot = await ref.once('value');
        const result = snapshot.val();
        if (result) {
            const loadedDates = Array.isArray(result)
                ? result.filter(Boolean)
                : Object.values(result);
            dates = loadedDates
                .filter(Boolean)
                .map(parseDateString)
                .sort((a, b) => a - b);
        } else {
            dates = [];
        }
    };

    const loadPresenceData = async () => {
        const ref = firebase.database().ref('presenceData');
        const snapshot = await ref.once('value');
        presenceData = snapshot.val() || {};
    };

    const savePresenceData = async () => {
        if (!database) return;
        try {
            await firebase.database().ref('presenceData').set(presenceData);
            syncStatus.textContent = 'Synchronisé ✓';
            syncStatus.style.color = 'green';
        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
            syncStatus.textContent = 'Erreur de sauvegarde';
            syncStatus.style.color = 'red';
        }
    };

    const updateSchedule = async () => {
        const monthValue = monthPicker.value || getCurrentMonthValue();
        monthPicker.value = monthValue;
        await loadUsers();
        await loadDatesForMonth(monthValue);
        await loadPresenceData();
        renderTable();
    };

    const onMonthChange = async () => {
        await updateSchedule();
    };

    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');

    prevMonthBtn.addEventListener('click', async () => {
        monthPicker.value = changeMonthValue(monthPicker.value, -1);
        await onMonthChange();
    });

    nextMonthBtn.addEventListener('click', async () => {
        monthPicker.value = changeMonthValue(monthPicker.value, 1);
        await onMonthChange();
    });

    const initFirebase = () => {
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK non chargé');
            syncStatus.textContent = 'Erreur: Firebase SDK non trouvé';
            syncStatus.style.color = 'red';
            return;
        }

        try {
            if (firebase.apps.length === 0) {
                firebase.initializeApp(firebaseConfig);
            }
            database = firebase.database();
            firebase.auth().signInAnonymously().then(async () => {
                syncStatus.textContent = 'Connecté ✓';
                syncStatus.style.color = 'green';
                await updateSchedule();
            }).catch((error) => {
                console.error('Erreur d\'authentification:', error);
                syncStatus.textContent = 'Erreur: ' + error.message;
                syncStatus.style.color = 'red';
            });
        } catch (error) {
            console.error('Erreur Firebase:', error);
            syncStatus.textContent = 'Erreur Firebase: ' + error.message;
            syncStatus.style.color = 'red';
        }
    };

    monthPicker.addEventListener('change', onMonthChange);
    monthPicker.value = getCurrentMonthValue();

    initFirebase();
});