// --- CONFIGURATION ---
// You can change these messages later
const NOTIFICATION_TEXTS = {
    title: "💧 Time to Hydrate!",
    body: "Don't forget to drink a glass of water.",
    followUpTitle: "💧 Quick Reminder!",
    followUpBody: "Just a nudge to drink some water. It's important!",
    doneAction: "Done!"
};

// Reminder interval in minutes. 
// Set to 60 for hourly reminders, or less for testing (e.g., 2 for every 2 mins).
const REMINDER_INTERVAL_MINUTES = 60; 

// --- SERVICE WORKER LOGIC ---

let reminderIntervalId = null;
let userSchedule = {};
let lastNotificationTime = null;

// On install, activate immediately
self.addEventListener('install', event => {
    self.skipWaiting();
});

// On activate, claim all clients
self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim());
});

// Listen for messages from the main app
self.addEventListener('message', event => {
    if (event.data.type === 'SET_SCHEDULE') {
        userSchedule = event.data.payload;
        console.log('SW received schedule:', userSchedule);
    }
    if (event.data.type === 'START_REMINDERS') {
        console.log('SW received start command.');
        startReminderLoop();
    }
    if (event.data.type === 'STOP_REMINDERS') {
        console.log('SW received stop command.');
        stopReminderLoop();
    }
});

// Handle clicking the notification's "Done" button
self.addEventListener('notificationclick', event => {
    if (event.action === 'done-action') {
        // User acknowledged the reminder. We can clear the timeout for the follow-up.
        // For simplicity, we just log it. The main goal is closing the notification.
        console.log('User clicked "Done".');
    }
    // This clears the 'water-reminder-acknowledged' flag for the next reminder.
    lastNotificationTime = null; 
    event.notification.close();
});


function startReminderLoop() {
    stopReminderLoop(); // Ensure no multiple loops are running
    console.log('Starting reminder loop...');
    // Check every minute if it's time to send a notification
    reminderIntervalId = setInterval(checkTimeAndNotify, 60 * 1000);
}

function stopReminderLoop() {
    if (reminderIntervalId) {
        clearInterval(reminderIntervalId);
        reminderIntervalId = null;
        console.log('Reminder loop stopped.');
    }
}

function checkTimeAndNotify() {
    if (!userSchedule.wakeUpTime || !userSchedule.sleepTime) {
        console.log("Waiting for user schedule...");
        return;
    }

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const isWakingHours = currentTime >= userSchedule.wakeUpTime && currentTime < userSchedule.sleepTime;
    // Handle overnight schedules (e.g., wake up 22:00, sleep 06:00)
    if (userSchedule.wakeUpTime > userSchedule.sleepTime) {
      if (currentTime >= userSchedule.wakeUpTime || currentTime < userSchedule.sleepTime) {
        // It's waking hours
      } else {
        return; // It's sleeping hours
      }
    } else if (!isWakingHours) {
        return; // It's sleeping hours
    }

    // Check if enough time has passed since the last notification
    const minutesSinceLastNotification = lastNotificationTime ? (now - lastNotificationTime) / (1000 * 60) : Infinity;

    if (minutesSinceLastNotification >= REMINDER_INTERVAL_MINUTES) {
        console.log('Time to send a reminder!');
        sendReminder();
        lastNotificationTime = now;
    }
}

function sendReminder(isFollowUp = false) {
    const title = isFollowUp ? NOTIFICATION_TEXTS.followUpTitle : NOTIFICATION_TEXTS.title;
    const options = {
        body: isFollowUp ? NOTIFICATION_TEXTS.followUpBody : NOTIFICATION_TEXTS.body,
        icon: 'icons/icon-192.png',
        tag: 'water-reminder', // This ensures new notifications replace old ones
        renotify: true, // This will make a sound/vibrate even if replacing an old notification
        actions: [
            { action: 'done-action', title: NOTIFICATION_TEXTS.doneAction }
        ],
        // A flag to know if this notification has been acknowledged. We'll check this.
        data: { acknowledged: false, notificationTime: Date.now() } 
    };

    self.registration.showNotification(title, options);

    // If this is the *first* notification, set a timer for the follow-up
    if (!isFollowUp) {
        setTimeout(() => {
            checkAndSendFollowUp();
        }, 60 * 1000); // 1 minute
    }
}

async function checkAndSendFollowUp() {
    // Get all notifications from this SW
    const notifications = await self.registration.getNotifications({ tag: 'water-reminder' });
    
    // If the original notification is still visible, it means the user hasn't clicked it.
    if (notifications.length > 0) {
        // Check if the notification is the one we sent a minute ago
        const originalNotificationTime = notifications[0].data.notificationTime;
        if (Date.now() - originalNotificationTime >= 59000) { // Check it's been about a minute
            console.log("User didn't interact. Sending a follow-up.");
            sendReminder(true); // Send the follow-up
        }
    }
}