document.addEventListener('DOMContentLoaded', () => {
    const syncStatus = document.getElementById('sync-status');
    const newUserInput = document.getElementById('new-user-input');
    const addUserBtn = document.getElementById('add-user-btn');
    const userList = document.getElementById('user-list');
    const adminMonthPicker = document.getElementById('admin-month-picker');
    const dateGrid = document.getElementById('date-grid');
    const refreshDatesBtn = document.getElementById('refresh-dates-btn');

    let users = [];
    let datesByMonth = {};
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

    const getCurrentMonthValue = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    };

    const parseMonthValue = (value) => {
        const [year, month] = value.split('-').map(Number);
        return { year, month: month - 1 };
    };

    const formatDateKey = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const normalizeDateKey = (dateString) => {
        const datePart = dateString.split('T')[0];
        const [year, month, day] = datePart.split('-').map(Number);
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const initFirebase = () => {
        if (typeof firebase === 'undefined') {
            syncStatus.textContent = 'Erreur: Firebase SDK non trouvé';
            syncStatus.style.color = 'red';
            return;
        }

        if (firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
        }
        database = firebase.database();

        firebase.auth().signInAnonymously().then(() => {
            syncStatus.textContent = 'Connecté ✓';
            syncStatus.style.color = 'green';
            adminMonthPicker.value = getCurrentMonthValue();
            loadAll();
        }).catch((error) => {
            console.error(error);
            syncStatus.textContent = 'Erreur auth';
            syncStatus.style.color = 'red';
        });
    };

    const loadUsers = async () => {
        const snapshot = await firebase.database().ref('users').once('value');
        const result = snapshot.val();
        users = Array.isArray(result) ? result.filter(Boolean) : (result ? Object.values(result) : []);
        users.sort();
    };

    const loadDatesByMonth = async () => {
        const snapshot = await firebase.database().ref('datesByMonth').once('value');
        const result = snapshot.val() || {};
        datesByMonth = Object.keys(result).reduce((acc, monthKey) => {
            const entries = Array.isArray(result[monthKey]) ? result[monthKey] : Object.values(result[monthKey]);
            acc[monthKey] = entries
                .filter(Boolean)
                .map(normalizeDateKey)
                .sort();
            return acc;
        }, {});
    };

    const getMonthDays = (year, month) => {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days = [];

        for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
            days.push(new Date(d));
        }
        return days;
    };

    const formatDate = (date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    };

    const saveUsers = async () => {
        await firebase.database().ref('users').set(users);
    };

    const saveDatesByMonth = async () => {
        await firebase.database().ref('datesByMonth').set(datesByMonth);
    };

    const renderUserList = () => {
        userList.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            li.textContent = user;
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Supprimer';
            removeBtn.addEventListener('click', async () => {
                users = users.filter(u => u !== user);
                await saveUsers();
                renderUserList();
            });
            li.appendChild(removeBtn);
            userList.appendChild(li);
        });
    };

    const renderDateGrid = () => {
        const monthValue = adminMonthPicker.value;
        const { year, month } = parseMonthValue(monthValue);
        const monthDays = getMonthDays(year, month);
        const selectedDates = new Set(datesByMonth[monthValue] || []);

        dateGrid.innerHTML = '';
        const daysOfWeek = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        const headerRow = document.createElement('div');
        headerRow.className = 'date-row date-row-header';
        daysOfWeek.forEach(dayName => {
            const cell = document.createElement('div');
            cell.className = 'date-item date-item-header';
            cell.textContent = dayName;
            headerRow.appendChild(cell);
        });
        dateGrid.appendChild(headerRow);

        const firstDay = new Date(year, month, 1);
        const offset = (firstDay.getDay() + 6) % 7;
        let week = [];

        for (let i = 0; i < offset; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'date-item date-item-empty';
            week.push(emptyCell);
        }

        monthDays.forEach(date => {
            const dateKey = formatDateKey(date);
            const cell = document.createElement('div');
            cell.className = 'date-item';
            cell.textContent = `${formatDate(date)}`;
            if (selectedDates.has(dateKey)) {
                cell.classList.add('selected');
            }
            cell.addEventListener('click', async () => {
                if (!datesByMonth[monthValue]) {
                    datesByMonth[monthValue] = [];
                }
                if (selectedDates.has(dateKey)) {
                    datesByMonth[monthValue] = datesByMonth[monthValue].filter(d => d !== dateKey);
                    selectedDates.delete(dateKey);
                    cell.classList.remove('selected');
                } else {
                    datesByMonth[monthValue].push(dateKey);
                    selectedDates.add(dateKey);
                    cell.classList.add('selected');
                }
                datesByMonth[monthValue].sort();
                await saveDatesByMonth();
            });
            week.push(cell);
            if (week.length === 7) {
                const row = document.createElement('div');
                row.className = 'date-row';
                week.forEach(item => row.appendChild(item));
                dateGrid.appendChild(row);
                week = [];
            }
        });

        if (week.length > 0) {
            while (week.length < 7) {
                const emptyCell = document.createElement('div');
                emptyCell.className = 'date-item date-item-empty';
                week.push(emptyCell);
            }
            const row = document.createElement('div');
            row.className = 'date-row';
            week.forEach(item => row.appendChild(item));
            dateGrid.appendChild(row);
        }
    };

    const loadAll = async () => {
        await loadUsers();
        await loadDatesByMonth();
        renderUserList();
        renderDateGrid();
    };

    addUserBtn.addEventListener('click', async () => {
        const newUser = newUserInput.value.trim();
        if (!newUser) return;
        if (!users.includes(newUser)) {
            users.push(newUser);
            users.sort();
            await saveUsers();
            renderUserList();
            newUserInput.value = '';
        }
    });

    refreshDatesBtn.addEventListener('click', async () => {
        await loadDatesByMonth();
        renderDateGrid();
    });

    adminMonthPicker.addEventListener('change', renderDateGrid);

    initFirebase();
});