// graph.js — TCM Graph API calls (Sprint 1: snapshot create, list, poll, get)

async function graphGet(token, url) {
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const errorCode = body?.error?.code || response.status;

        // Detect specific TCM setup failures
        if (response.status === 403) {
            if (String(body?.error?.message).includes("service principal")) {
                throw { tcmError: "TCM_SP_MISSING", message: body.error.message };
            }
            throw { tcmError: "CONSENT_REQUIRED", message: body.error.message || "Forbidden" };
        }

        throw new Error(`Graph API error ${response.status}: ${errorCode} — ${body?.error?.message || ""}`);
    }

    return response.json();
}

async function graphPost(token, url, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const respBody = await response.json().catch(() => ({}));
        const errorCode = respBody?.error?.code || response.status;

        if (response.status === 403) {
            if (String(respBody?.error?.message).includes("service principal")) {
                throw { tcmError: "TCM_SP_MISSING", message: respBody.error.message };
            }
            throw { tcmError: "CONSENT_REQUIRED", message: respBody.error.message || "Forbidden" };
        }

        throw new Error(`Graph API error ${response.status}: ${errorCode} — ${respBody?.error?.message || ""}`);
    }

    return response.json();
}

// Placeholder — Sprint 1 will add:
// - createSnapshot(token, resourceTypes)
// - getSnapshotJobs(token)
// - pollSnapshotJob(token, jobId)
// - getSnapshot(token, snapshotId)

// --- Sprint 1: Snapshot management ---

async function createSnapshot(token, displayName, description, resources) {
    return graphPost(token, `${graphBaseUrl}/admin/configurationManagement/configurationSnapshots/createSnapshot`, {
        displayName,
        description,
        resources,
    });
}

async function getSnapshotJobs(token) {
    const url = `${graphBaseUrl}/admin/configurationManagement/configurationSnapshotJobs?$select=id,displayName,description,status,createdDateTime,completedDateTime,resourceLocation,resources,createdBy,errorDetails&$orderby=createdDateTime desc`;
    return graphGet(token, url);
}

const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

async function getSnapshotJob(token, jobId) {
    if (!GUID_RE.test(jobId)) throw new Error("Invalid snapshot job ID");
    const url = `${graphBaseUrl}/admin/configurationManagement/configurationSnapshotJobs('${jobId}')`;
    return graphGet(token, url);
}

async function getSnapshot(token, snapshotId) {
    if (!GUID_RE.test(snapshotId)) throw new Error("Invalid snapshot ID");
    const url = `${graphBaseUrl}/admin/configurationManagement/configurationSnapshots('${snapshotId}')`;
    return graphGet(token, url);
}
