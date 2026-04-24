// Default (shared) app registration — multi-tenant, no secrets, PKCE only.
// Users can override this with their own client ID via the settings panel.
const DEFAULT_CLIENT_ID = "92b2d45d-f944-41d9-9cf5-0a17811624ff";

const CUSTOM_CLIENT_ID_KEY = "tcm_custom_client_id";

function getActiveClientId() {
    const custom = localStorage.getItem(CUSTOM_CLIENT_ID_KEY);
    return (custom && custom.trim()) ? custom.trim() : DEFAULT_CLIENT_ID;
}

function isUsingCustomClientId() {
    const custom = localStorage.getItem(CUSTOM_CLIENT_ID_KEY);
    return !!(custom && custom.trim());
}

function setCustomClientId(clientId) {
    if (clientId && clientId.trim()) {
        localStorage.setItem(CUSTOM_CLIENT_ID_KEY, clientId.trim());
    } else {
        localStorage.removeItem(CUSTOM_CLIENT_ID_KEY);
    }
}

function buildMsalConfig() {
    return {
        auth: {
            clientId: getActiveClientId(),
            authority: "https://login.microsoftonline.com/common",
            redirectUri: window.location.origin + window.location.pathname,
        },
        cache: {
            cacheLocation: "sessionStorage",
            storeAuthStateInCookie: false,
        },
    };
}

const graphScopes = ["user.read", "ConfigurationMonitoring.ReadWrite.All"];

const graphBaseUrl = "https://graph.microsoft.com/v1.0";
