document.addEventListener('DOMContentLoaded', () => {
    const syncStatus = document.getElementById('sync-status');
    const headerRow1 = document.getElementById('header-row-1');
    const headerRow2 = document.getElementById('header-row-2');
    const tableBody = document.getElementById('table-body');
    const userInput = document.getElementById('user-input');
    const addUserBtn = document.getElementById('add-user-btn');

    let presenceData = {};
    let users = [];
    let database = null;
    let dates = [];

    // Configuration Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyBHT1mdJvnJxq7lf5jw3uvyODD0cbG8Oxc",
        authDomain: "agendaguirbaden.firebaseapp.com",
        projectId: "agendaguirbaden",
        storageBucket: "agendaguirbaden.firebasestorage.app",
        messagingSenderId: "739762268039",
        appId: "1:739762268039:web:a25255a3b95110c3e75522",
        databaseURL: "https://agendaguirbaden-default-rtdb.europe-west1.firebasedatabase.app"
    };

    // Obtenir les lundis et samedis du mois
    const getWeekendDates = () => {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        let weekendDates = [];
        for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            // 1 = lundi, 6 = samedi
            if (dayOfWeek === 1 || dayOfWeek === 6) {
                weekendDates.push(new Date(d));
            }
        }
        return weekendDates;
    };

    // Formater une date pour affichage
    const formatDate = (date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    };

    // Formater une date pour la clé Firebase
    const formatDateKey = (date) => {
        return date.toISOString().split('T')[0];
    };

    // Obtenir le jour de la semaine
    const getDayName = (date) => {
        const days = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
        return days[date.getDay()];
    };

    // Initialiser les dates
    dates = getWeekendDates();

    // Rendre l'entête de la table
    const renderHeader = () => {
        // Première ligne d'entête
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
        
        // Deuxième ligne d'entête avec Matin/Après-midi
        let header2Html = '<th class="user-column"></th>';
        dates.forEach(() => {
            header2Html += '<th class="shift-header">Matin</th><th class="shift-header">Après</th>';
        });
        headerRow2.innerHTML = header2Html;
    };

    // Rendre la table
    const renderTable = () => {
        renderHeader();
        tableBody.innerHTML = '';
        
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `<td class="user-name">${user}</td>`;
            
            dates.forEach(date => {
                const dateKey = formatDateKey(date);
                const userKey = user;
                const matinKey = `${dateKey}-matin`;
                const apresKey = `${dateKey}-apres`;
                
                // Initialiser si nécessaire
                if (!presenceData[userKey]) {
                    presenceData[userKey] = {};
                }
                
                const matinStatus = presenceData[userKey][matinKey] || 'absent';
                const apresStatus = presenceData[userKey][apresKey] || 'absent';
                
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
        
        // Ajouter les event listeners
        document.querySelectorAll('.cell').forEach(cell => {
            cell.addEventListener('click', toggleCell);
        });
    };

    // Obtenir le symbole correspondant au statut
    const getStatusSymbol = (status) => {
        switch(status) {
            case 'present': return '✓';
            case 'maybe': return '?';
            case 'absent':
            default: return '✗';
        }
    };

    // Basculer le statut d'une cellule (absent -> present -> maybe -> absent)
    const toggleCell = (e) => {
        const cell = e.target;
        const user = cell.dataset.user;
        const date = cell.dataset.date;
        const shift = cell.dataset.shift;
        const key = `${date}-${shift}`;
        
        if (!presenceData[user]) {
            presenceData[user] = {};
        }
        
        // Cycle: absent -> present -> maybe -> absent
        let currentStatus = presenceData[user][key] || 'absent';
        let newStatus;
        
        switch(currentStatus) {
            case 'absent':
                newStatus = 'present';
                break;
            case 'present':
                newStatus = 'maybe';
                break;
            case 'maybe':
                newStatus = 'absent';
                break;
            default:
                newStatus = 'present';
        }
        
        presenceData[user][key] = newStatus;
        
        // Mettre à jour l'affichage
        cell.className = `cell status-${newStatus}`;
        cell.textContent = getStatusSymbol(newStatus);
        
        savePresenceData();
    };

    // Ajouter un utilisateur
    const addUser = () => {
        const newUser = userInput.value.trim();
        if (newUser && !users.includes(newUser)) {
            users.push(newUser);
            users.sort();
            userInput.value = '';
            renderTable();
            savePresenceData();
        }
    };

    // Sauvegarder les données dans Firebase
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

    // Charger les données depuis Firebase
    const loadPresenceData = () => {
        if (!database) {
            syncStatus.textContent = 'Erreur: Base de données non accessible';
            syncStatus.style.color = 'red';
            renderTable();
            return;
        }
        const ref = firebase.database().ref('presenceData');
        ref.once('value', (snapshot) => {
            presenceData = snapshot.val() || {};
            users = Object.keys(presenceData).sort();
            syncStatus.textContent = 'Synchronisé ✓';
            syncStatus.style.color = 'green';
            renderTable();
        }).catch((error) => {
            console.error('Erreur lors du chargement:', error);
            syncStatus.textContent = 'Erreur: ' + error.message;
            syncStatus.style.color = 'red';
            renderTable();
        });
    };

    // Initialiser Firebase
    const initFirebase = () => {
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK non chargé');
            syncStatus.textContent = 'Erreur: Firebase SDK non trouvé';
            syncStatus.style.color = 'red';
            renderTable();
            return;
        }
        
        try {
            if (firebase.apps.length === 0) {
                firebase.initializeApp(firebaseConfig);
            }
            database = firebase.database();
            
            // Authentification anonyme
            firebase.auth().signInAnonymously().then(() => {
                loadPresenceData();
            }).catch((error) => {
                console.error('Erreur d\'authentification:', error);
                syncStatus.textContent = 'Erreur: ' + error.message;
                syncStatus.style.color = 'red';
                renderTable();
            });
        } catch (error) {
            console.error('Erreur Firebase:', error);
            syncStatus.textContent = 'Erreur Firebase: ' + error.message;
            syncStatus.style.color = 'red';
            renderTable();
        }
    };

    // Event listeners
    addUserBtn.addEventListener('click', addUser);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addUser();
    });

    initFirebase();
});