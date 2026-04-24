// main.js — Bootstrap the app after all scripts are loaded

initMsal().then(() => {
    renderAuthState();

    // Wire up Compare button
    const compareBtn = document.getElementById("compare-btn");
    if (compareBtn) {
        compareBtn.addEventListener("click", () => {
            const sourceData = snapshotState.source.snapshotData;
            const destData = snapshotState.dest.snapshotData;
            if (!sourceData || !destData) return;
            renderCompareResults(sourceData, destData);
        });
    }
}).catch((error) => {
    console.error("MSAL init failed:", error);
    const container = document.querySelector(".container");
    if (container) {
        const alert = document.createElement("div");
        alert.className = "alert alert-danger mt-4";
        alert.textContent = "Failed to initialize authentication: " + error.message + ". Check the Settings panel to configure your app registration.";
        container.prepend(alert);
    }
});
