document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const setupScreen = document.getElementById('setup-screen');
    const mainScreen = document.getElementById('main-screen');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const enableNotificationsBtn = document.getElementById('enable-notifications-btn');
    const resetBtn = document.getElementById('reset-btn');

    // Register the Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered successfully', reg))
            .catch(err => console.error('Service Worker registration failed', err));
    }

    // Function to update the UI based on saved settings
    function updateUI() {
        const settings = getSettings();
        if (settings.name && settings.wakeUpTime && settings.sleepTime) {
            // Show main screen
            setupScreen.style.display = 'none';
            mainScreen.style.display = 'block';

            document.getElementById('welcome-message').textContent = `Hello, ${settings.name}!`;
            document.getElementById('wake-up-display').textContent = settings.wakeUpTime;
            document.getElementById('sleep-display').textContent = settings.sleepTime;

            // Update notification button state
            if (Notification.permission === 'granted') {
                enableNotificationsBtn.textContent = 'Reminders are Active';
                enableNotificationsBtn.disabled = true;
                document.getElementById('notification-status').textContent = 'We will notify you during your waking hours.';
            }

        } else {
            // Show setup screen
            setupScreen.style.display = 'block';
            mainScreen.style.display = 'none';
        }
    }

    // Get settings from localStorage
    function getSettings() {
        return {
            name: localStorage.getItem('userName'),
            wakeUpTime: localStorage.getItem('wakeUpTime'),
            sleepTime: localStorage.getItem('sleepTime'),
        };
    }

    // Save settings to localStorage
    saveSettingsBtn.addEventListener('click', () => {
        const name = document.getElementById('name-input').value;
        const wakeUpTime = document.getElementById('wake-up-input').value;
        const sleepTime = document.getElementById('sleep-input').value;

        if (!name || !wakeUpTime || !sleepTime) {
            alert('Please fill in all fields.');
            return;
        }

        localStorage.setItem('userName', name);
        localStorage.setItem('wakeUpTime', wakeUpTime);
        localStorage.setItem('sleepTime', sleepTime);

        // Send settings to the service worker
        sendSettingsToSW();
        updateUI();
    });

    // Enable Notifications
    enableNotificationsBtn.addEventListener('click', () => {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('Notification permission granted.');
                updateUI();
                // Tell SW to start reminders now that permission is granted
                sendStartCommandToSW(); 
            } else {
                console.log('Notification permission denied.');
                document.getElementById('notification-status').textContent = 'Please enable notifications to get reminders.';
            }
        });
    });

    // Reset settings
    resetBtn.addEventListener('click', () => {
        localStorage.clear();
        // Tell SW to stop reminders
        navigator.serviceWorker.ready.then(registration => {
            registration.active.postMessage({ type: 'STOP_REMINDERS' });
        });
        window.location.reload();
    });

    function sendSettingsToSW() {
        const settings = getSettings();
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'SET_SCHEDULE',
                payload: settings
            });
        }
    }

    function sendStartCommandToSW() {
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'START_REMINDERS' });
        }
    }
    
    // Initial UI update on page load
    updateUI();
    // Send settings to SW on load in case it was restarted
    sendSettingsToSW();
});