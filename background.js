chrome.webRequest.onCompleted.addListener(
  function (details) {
    // Only intercept the specific workout API endpoint
    if (details.url.includes("/api/public/workout/get/all")) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "interceptedWorkoutData",
            url: details.url,
          });
        }
      });
    }
  },
  { urls: ["*://hiltibjj.gymsystem.se/api/public/workout/get/all*"] }
);
