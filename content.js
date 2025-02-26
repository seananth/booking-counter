// This script runs in the context of the gym website

// Store our data here when we receive it
let workoutData = null;

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "interceptedWorkoutData") {
    // Fetch the same URL to get the data
    fetchWorkoutData(message.url);
  }
});

// Function to fetch the workout data
function fetchWorkoutData(url) {
  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      workoutData = data;
      displayBookingNumbers();
    })
    .catch((error) => console.error("Error fetching workout data:", error));
}

// Function to display booking numbers on the page
function displayBookingNumbers() {
  // We should have the workouts in workoutData.workouts
  if (!workoutData || !workoutData.workouts) return;

  // Wait for the DOM to be ready with the workout elements
  setTimeout(findAndUpdateWorkouts, 1000);
}

// Function to find workout elements and update them with booking numbers
function findAndUpdateWorkouts() {
  // Map the workouts by ID for easy lookup
  const workoutsById = {};
  workoutData.workouts.forEach((workout) => {
    workoutsById[workout.id] = workout;
  });

  // Look for workout elements on the page
  // Different selectors depending on the page structure
  // You may need to adjust these based on the actual HTML structure

  // Try multiple possible selectors
  const workoutElements = document.querySelectorAll(
    ".workout-item, .class-item, [data-workout-id]"
  );

  let foundMatches = 0;

  workoutElements.forEach((element) => {
    // Try to find the workout ID
    let workoutId =
      element.dataset.workoutId ||
      element.getAttribute("data-id") ||
      element.getAttribute("data-workout-id");

    // If we couldn't find an ID attribute, try to find it in a child element or in the URL
    if (!workoutId) {
      // Look for links that might contain the workout ID
      const links = element.querySelectorAll('a[href*="workout"]');
      for (const link of links) {
        const href = link.getAttribute("href");
        const match = href.match(/workout\/(\d+)/);
        if (match && match[1]) {
          workoutId = match[1];
          break;
        }
      }
    }

    // If we found a workout ID and it exists in our data
    if (workoutId && workoutsById[workoutId]) {
      const workout = workoutsById[workoutId];

      // Create or update the booking number display
      let bookingDisplay = element.querySelector(".booking-count");
      if (!bookingDisplay) {
        bookingDisplay = document.createElement("div");
        bookingDisplay.className = "booking-count";
        bookingDisplay.style.fontWeight = "bold";
        bookingDisplay.style.color = "#ff5722"; // Orange color to stand out
        bookingDisplay.style.margin = "5px 0";
        element.appendChild(bookingDisplay);
      }

      // Set the booking information
      bookingDisplay.textContent = `👥 Booked: ${workout.numBooked}`;

      foundMatches++;
    }
  });

  // If we couldn't find matches with the above method, try a different approach
  if (foundMatches === 0) {
    // This is a fallback approach for when the page structure is different
    // Look for date and time elements, then try to match with our workout data
    const allWorkoutContainers = document.querySelectorAll(
      ".calendar-item, .schedule-item, .day-item"
    );

    allWorkoutContainers.forEach((container) => {
      // Try to extract date and time information
      const dateElem = container.querySelector(".date, [data-date]");
      const timeElems = container.querySelectorAll(
        ".time, .start-time, [data-time]"
      );

      if (dateElem && timeElems.length > 0) {
        timeElems.forEach((timeElem) => {
          // Look for workout type/name elements near this time
          const workoutElems = timeElem.parentElement.querySelectorAll(
            ".workout-name, .class-name, .activity-name"
          );

          workoutElems.forEach((workoutElem) => {
            // Try to match with our data based on date, time and name
            for (const workout of workoutData.workouts) {
              // Very simple matching - this would need refinement based on the actual page structure
              if (workoutElem.textContent.includes(workout.workoutType.name)) {
                // Create booking display
                let bookingDisplay =
                  workoutElem.querySelector(".booking-count");
                if (!bookingDisplay) {
                  bookingDisplay = document.createElement("span");
                  bookingDisplay.className = "booking-count";
                  bookingDisplay.style.fontWeight = "bold";
                  bookingDisplay.style.color = "#ff5722";
                  bookingDisplay.style.marginLeft = "10px";
                  workoutElem.appendChild(bookingDisplay);
                }

                bookingDisplay.textContent = `👥 ${workout.numBooked}`;
                break;
              }
            }
          });
        });
      }
    });
  }

  // If still no matches, we need a more aggressive approach - inject a floating panel
  if (foundMatches === 0) {
    createFloatingBookingPanel();
  }
}

// Create a floating panel with all workout booking information
function createFloatingBookingPanel() {
  let panel = document.getElementById("booking-info-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "booking-info-panel";
    panel.style.position = "fixed";
    panel.style.right = "20px";
    panel.style.top = "20px";
    panel.style.zIndex = "9999";
    panel.style.backgroundColor = "white";
    panel.style.border = "1px solid #ccc";
    panel.style.borderRadius = "5px";
    panel.style.padding = "10px";
    panel.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
    panel.style.maxHeight = "80vh";
    panel.style.overflowY = "auto";
    panel.style.width = "300px";
    document.body.appendChild(panel);

    // Add a header and close button
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.marginBottom = "10px";
    panel.appendChild(header);

    const title = document.createElement("h3");
    title.textContent = "Class Booking Counts";
    title.style.margin = "0";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "X";
    closeBtn.style.border = "none";
    closeBtn.style.background = "none";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontWeight = "bold";
    closeBtn.onclick = function () {
      panel.style.display = "none";
    };
    header.appendChild(closeBtn);

    // Sort workouts by time
    const sortedWorkouts = [...workoutData.workouts].sort((a, b) => {
      return new Date(a.startTime) - new Date(b.startTime);
    });

    // Group workouts by date
    const workoutsByDate = {};
    sortedWorkouts.forEach((workout) => {
      const date = workout.startTime.split(" ")[0];
      if (!workoutsByDate[date]) {
        workoutsByDate[date] = [];
      }
      workoutsByDate[date].push(workout);
    });

    // Create a section for each date
    Object.keys(workoutsByDate).forEach((date) => {
      const dateSection = document.createElement("div");
      dateSection.style.marginBottom = "15px";
      panel.appendChild(dateSection);

      const dateHeader = document.createElement("h4");
      dateHeader.textContent = formatDate(date);
      dateHeader.style.margin = "5px 0";
      dateHeader.style.borderBottom = "1px solid #eee";
      dateSection.appendChild(dateHeader);

      // Add each workout for this date
      workoutsByDate[date].forEach((workout) => {
        const workoutItem = document.createElement("div");
        workoutItem.style.padding = "5px 0";
        workoutItem.style.display = "flex";
        workoutItem.style.justifyContent = "space-between";
        dateSection.appendChild(workoutItem);

        const workoutInfo = document.createElement("div");
        workoutInfo.innerHTML = `
          <strong>${workout.workoutType.name}</strong><br>
          ${formatTime(workout.startTime)} - ${formatTime(workout.endTime)}
        `;
        workoutItem.appendChild(workoutInfo);

        const bookingCount = document.createElement("div");
        bookingCount.textContent = `👥 ${workout.numBooked}`;
        bookingCount.style.fontWeight = "bold";

        // Color code based on booking numbers
        if (workout.numBooked >= 10) {
          bookingCount.style.color = "#e53935"; // Red - getting full
        } else if (workout.numBooked >= 5) {
          bookingCount.style.color = "#fb8c00"; // Orange - moderately booked
        } else {
          bookingCount.style.color = "#43a047"; // Green - plenty of space
        }

        workoutItem.appendChild(bookingCount);
      });
    });
  } else {
    // If panel exists but is hidden, show it
    panel.style.display = "block";
  }
}

// Helper function to format date
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("sv-SE", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// Helper function to format time
function formatTime(dateTimeStr) {
  const time = dateTimeStr.split(" ")[1];
  return time.substring(0, 5); // Format: HH:MM
}

// Run initial check when page loads
window.addEventListener("load", function () {
  // Check every few seconds for new page content
  setInterval(function () {
    if (workoutData) {
      displayBookingNumbers();
    }
  }, 2000);
});

// Add a mutation observer to detect DOM changes
const observer = new MutationObserver(function (mutations) {
  if (workoutData) {
    displayBookingNumbers();
  }
});

// Start observing once the page has loaded
window.addEventListener("load", function () {
  observer.observe(document.body, { childList: true, subtree: true });
});
