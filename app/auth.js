// auth.js — MSAL init, dual-account sign-in/out
let msalInstance = null;
let sourceAccount = null;
let destAccount = null;

async function initMsal() {
    const config = buildMsalConfig();
    msalInstance = new msal.PublicClientApplication(config);

    // Restore accounts from session if page was refreshed
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length >= 1) {
        sourceAccount = accounts[0];
    }
    if (accounts.length >= 2) {
        destAccount = accounts[1];
    }
}

// Re-initialize MSAL when the user changes the client ID in settings.
// Clears all cached accounts since tokens are tied to the old client ID.
async function reinitMsal() {
    sourceAccount = null;
    destAccount = null;
    sessionStorage.clear();
    await initMsal();
    renderAuthState();
}

async function signInSource() {
    try {
        const response = await msalInstance.loginPopup({
            scopes: graphScopes,
            prompt: "select_account",
        });
        sourceAccount = response.account;
        renderAuthState();
    } catch (error) {
        console.error("Source sign-in failed:", error);
        if (error.errorCode === "popup_window_error" || error.errorCode === "empty_window_error") {
            showError("source",
                "Could not open the sign-in popup. This can happen if:\n" +
                "• Your browser is blocking pop-ups for this site\n" +
                "• Another sign-in popup is already open\n\n" +
                "Try allowing pop-ups for this site, or use a different browser profile.");
        } else if (error.errorCode === "user_cancelled") {
            // User closed the popup — no need to show an error
        } else {
            showError("source", "Sign-in failed: " + error.message);
        }
    }
}

async function signInDest() {
    try {
        const response = await msalInstance.loginPopup({
            scopes: graphScopes,
            prompt: "select_account",
        });

        // Prevent signing into the same account for both panels
        if (sourceAccount && response.account.homeAccountId === sourceAccount.homeAccountId) {
            showError("dest", "You signed into the same account as the source tenant. Please choose a different account.");
            await msalInstance.logoutPopup({ account: response.account, mainWindowRedirectUri: window.location.href });
            return;
        }

        destAccount = response.account;
        renderAuthState();
    } catch (error) {
        console.error("Destination sign-in failed:", error);
        if (error.errorCode === "popup_window_error" || error.errorCode === "empty_window_error") {
            showError("dest",
                "Could not open the sign-in popup. This can happen if:\n" +
                "• Your browser is blocking pop-ups for this site\n" +
                "• You are already signed in with this account in the source tenant — please use a different account or tenant\n" +
                "• Another sign-in popup is already open\n\n" +
                "Try allowing pop-ups for this site, or use a different browser profile.");
        } else if (error.errorCode === "user_cancelled") {
            // User closed the popup — no need to show an error
        } else {
            showError("dest", "Sign-in failed: " + error.message);
        }
    }
}

async function signOutSource() {
    if (!sourceAccount) return;
    try {
        await msalInstance.logoutPopup({ account: sourceAccount });
    } catch (error) {
        console.error("Source sign-out error:", error);
    }
    sourceAccount = null;
    // Clear snapshot state for this side
    if (typeof snapshotState !== "undefined") {
        clearInterval(snapshotState.source.polling);
        snapshotState.source = { jobs: [], selectedSnapshotId: null, snapshotData: null, polling: null };
    }
    renderAuthState();
}

async function signOutDest() {
    if (!destAccount) return;
    try {
        await msalInstance.logoutPopup({ account: destAccount });
    } catch (error) {
        console.error("Destination sign-out error:", error);
    }
    destAccount = null;
    // Clear snapshot state for this side
    if (typeof snapshotState !== "undefined") {
        clearInterval(snapshotState.dest.polling);
        snapshotState.dest = { jobs: [], selectedSnapshotId: null, snapshotData: null, polling: null };
    }
    renderAuthState();
}

async function getToken(account) {
    if (!account) throw new Error("No account provided");

    const request = {
        scopes: graphScopes,
        account: account,
    };

    try {
        const response = await msalInstance.acquireTokenSilent(request);
        return response.accessToken;
    } catch (error) {
        // Silent token acquisition failed — fall back to popup
        if (error instanceof msal.InteractionRequiredAuthError) {
            const response = await msalInstance.acquireTokenPopup(request);
            return response.accessToken;
        }
        throw error;
    }
}

async function getSourceToken() {
    return getToken(sourceAccount);
}

async function getDestToken() {
    return getToken(destAccount);
}
