// snapshot.js — Snapshot management: presets, create, poll, select

// --- Resource type presets ---
const RESOURCE_PRESETS = {
    "Entra ID": [
        "microsoft.entra.application",
        "microsoft.entra.authenticationstrengthpolicy",
        "microsoft.entra.authorizationpolicy",
        "microsoft.entra.conditionalaccesspolicy",
        "microsoft.entra.crosstenantaccesspolicy",
        "microsoft.entra.crosstenantaccesspolicyconfigurationdefault",
        "microsoft.entra.crosstenantaccesspolicyconfigurationpartner",
        "microsoft.entra.externalidentitypolicy",
        "microsoft.entra.grouplifecyclepolicy",
        "microsoft.entra.namedlocationpolicy",
        "microsoft.entra.roledefinition",
        "microsoft.entra.rolesetting",
        "microsoft.entra.securitydefaults",
        "microsoft.entra.tenantdetails",
        "microsoft.entra.tokenlifetimepolicy",
        "microsoft.entra.user",
        "microsoft.entra.group",
        "microsoft.entra.serviceprincipal",
        "microsoft.entra.authenticationmethodpolicy",
        "microsoft.entra.authenticationmethodpolicyauthenticator",
        "microsoft.entra.authenticationmethodpolicyemail",
        "microsoft.entra.authenticationmethodpolicyfido2",
        "microsoft.entra.authenticationmethodpolicysms",
        "microsoft.entra.authenticationmethodpolicysoftware",
        "microsoft.entra.authenticationmethodpolicytemporary",
        "microsoft.entra.authenticationmethodpolicyvoice",
        "microsoft.entra.authenticationmethodpolicyx509",
        "microsoft.entra.roleeligibilityschedulerequest",
        "microsoft.entra.administrativeunit",
        "microsoft.entra.authenticationcontextclassreference",
        "microsoft.entra.entitlementmanagementaccesspackage",
        "microsoft.entra.entitlementmanagementaccesspackageassignmentpolicy",
        "microsoft.entra.entitlementmanagementaccesspackagecatalog",
        "microsoft.entra.entitlementmanagementaccesspackagecatalogresource",
        "microsoft.entra.entitlementmanagementconnectedorganization",
        "microsoft.entra.socialidentityprovider",
    ],
    "Exchange": [
        "microsoft.exchange.accepteddomain",
        "microsoft.exchange.activesyncdeviceaccessrule",
        "microsoft.exchange.antiphishpolicy",
        "microsoft.exchange.antiphishrule",
        "microsoft.exchange.atppolicyforo365",
        "microsoft.exchange.authenticationpolicy",
        "microsoft.exchange.authenticationpolicyassignment",
        "microsoft.exchange.availabilityaddressspace",
        "microsoft.exchange.availabilityconfig",
        "microsoft.exchange.calendarprocessing",
        "microsoft.exchange.casmailboxplan",
        "microsoft.exchange.casmailboxsettings",
        "microsoft.exchange.dataclassification",
        "microsoft.exchange.dataencryptionpolicy",
        "microsoft.exchange.distributiongroup",
        "microsoft.exchange.dkimsigningconfig",
        "microsoft.exchange.emailaddresspolicy",
        "microsoft.exchange.groupsettings",
        "microsoft.exchange.hostedconnectionfilterpolicy",
        "microsoft.exchange.hostedcontentfilterpolicy",
        "microsoft.exchange.hostedcontentfilterrule",
        "microsoft.exchange.hostedoutboundspamfilterpolicy",
        "microsoft.exchange.hostedoutboundspamfilterrule",
        "microsoft.exchange.inboundconnector",
        "microsoft.exchange.intraorganizationconnector",
        "microsoft.exchange.irmconfiguration",
        "microsoft.exchange.journalrule",
        "microsoft.exchange.mailcontact",
        "microsoft.exchange.mailtips",
        "microsoft.exchange.malwarefilterpolicy",
        "microsoft.exchange.malwarefilterrule",
        "microsoft.exchange.managementrole",
        "microsoft.exchange.managementroleassignment",
        "microsoft.exchange.messageclassification",
        "microsoft.exchange.mobiledevicemailboxpolicy",
        "microsoft.exchange.omeconfiguration",
        "microsoft.exchange.onpremisesorganization",
        "microsoft.exchange.organizationconfig",
        "microsoft.exchange.organizationrelationship",
        "microsoft.exchange.outboundconnector",
        "microsoft.exchange.owamailboxpolicy",
        "microsoft.exchange.partnerapplication",
        "microsoft.exchange.perimeterconfiguration",
        "microsoft.exchange.place",
        "microsoft.exchange.policytipconfig",
        "microsoft.exchange.quarantinepolicy",
        "microsoft.exchange.recipientpermission",
        "microsoft.exchange.remotedomain",
        "microsoft.exchange.reportsubmissionpolicy",
        "microsoft.exchange.reportsubmissionrule",
        "microsoft.exchange.resourceconfiguration",
        "microsoft.exchange.roleassignmentpolicy",
        "microsoft.exchange.rolegroup",
        "microsoft.exchange.safeattachmentpolicy",
        "microsoft.exchange.safeattachmentrule",
        "microsoft.exchange.safelinkspolicy",
        "microsoft.exchange.safelinksrule",
        "microsoft.exchange.sharedmailbox",
        "microsoft.exchange.sharingpolicy",
        "microsoft.exchange.transportconfig",
        "microsoft.exchange.transportrule",
    ],
    "Teams": [
        "microsoft.teams.apppermissionpolicy",
        "microsoft.teams.appsetuppolicy",
        "microsoft.teams.callingpolicy",
        "microsoft.teams.callparkpolicy",
        "microsoft.teams.channelspolicy",
        "microsoft.teams.clientconfiguration",
        "microsoft.teams.cortanapolicy",
        "microsoft.teams.dialinconferencingtenantsettings",
        "microsoft.teams.enhancedencryptionpolicy",
        "microsoft.teams.eventspolicy",
        "microsoft.teams.federationconfiguration",
        "microsoft.teams.feedbackpolicy",
        "microsoft.teams.filespolicy",
        "microsoft.teams.guestcallingconfiguration",
        "microsoft.teams.guestmeetingconfiguration",
        "microsoft.teams.guestmessagingconfiguration",
        "microsoft.teams.ipphonepolicy",
        "microsoft.teams.meetingbroadcastpolicy",
        "microsoft.teams.meetingconfiguration",
        "microsoft.teams.meetingpolicy",
        "microsoft.teams.messagingpolicy",
        "microsoft.teams.mobilitypolicy",
        "microsoft.teams.networkroamingpolicy",
        "microsoft.teams.onlinevoicemailpolicy",
        "microsoft.teams.shiftspolicy",
        "microsoft.teams.templatespolicy",
        "microsoft.teams.tenantnetworkregion",
        "microsoft.teams.tenantnetworksite",
        "microsoft.teams.tenantnetworksubnet",
        "microsoft.teams.tenanttrustedipaddress",
        "microsoft.teams.translationrule",
        "microsoft.teams.unassignednumbertreatment",
        "microsoft.teams.upgradeconfiguration",
        "microsoft.teams.vdipolicy",
        "microsoft.teams.voiceroute",
        "microsoft.teams.voiceroutingpolicy",
        "microsoft.teams.workloadpolicy",
        "microsoft.teams.callholdpolicy",
        "microsoft.teams.updatemanagementpolicy",
        "microsoft.teams.pstnusage",
        "microsoft.teams.upgradepolicy",
        "microsoft.teams.tenantdialplan",
        "microsoft.teams.meetingbroadcastconfiguration",
        "microsoft.teams.audioconferencingpolicy",
        "microsoft.teams.compliancerecordingpolicy",
        "microsoft.teams.emergencycallingpolicy",
        "microsoft.teams.emergencycallroutingpolicy",
        "microsoft.teams.grouppolicyassignment",
        "microsoft.teams.onlinevoiceuser",
        "microsoft.teams.user",
        "microsoft.teams.callqueue",
    ],
    "Intune": [
        "microsoft.intune.devicecompliancepolicyandroid",
        "microsoft.intune.devicecompliancepolicyandroiddeviceowner",
        "microsoft.intune.devicecompliancepolicyandroidworkprofile",
        "microsoft.intune.devicecompliancepolicyios",
        "microsoft.intune.devicecompliancepolicymacos",
        "microsoft.intune.devicecompliancepolicywindows10",
        "microsoft.intune.deviceconfigurationpolicywindows10",
        "microsoft.intune.deviceconfigurationpolicyandroiddeviceowner",
        "microsoft.intune.deviceconfigurationpolicyandroidworkprofile",
        "microsoft.intune.deviceconfigurationpolicyandroidopensourceproject",
        "microsoft.intune.deviceconfigurationpolicyandroiddeviceadministrator",
        "microsoft.intune.deviceconfigurationpolicyios",
        "microsoft.intune.deviceconfigurationpolicymacos",
        "microsoft.intune.deviceconfigurationadministrativetemplatepolicywindows10",
        "microsoft.intune.deviceconfigurationcustompolicywindows10",
        "microsoft.intune.deviceconfigurationendpointprotectionpolicywindows10",
        "microsoft.intune.deviceconfigurationidentityprotectionpolicywindows10",
        "microsoft.intune.settingcatalogcustompolicywindows10",
        "microsoft.intune.appprotectionpolicyandroid",
        "microsoft.intune.appprotectionpolicyios",
        "microsoft.intune.appconfigurationpolicy",
        "microsoft.intune.deviceenrollmentplatformrestriction",
        "microsoft.intune.deviceenrollmentlimitrestriction",
        "microsoft.intune.deviceenrollmentstatuspagewindows10",
        "microsoft.intune.devicecategory",
        "microsoft.intune.roledefinition",
        "microsoft.intune.roleassignment",
        "microsoft.intune.policysets",
        "microsoft.intune.deviceandappmanagementassignmentfilter",
        "microsoft.intune.windowsautopilotdeploymentprofileazureadjoined",
        "microsoft.intune.windowsautopilotdeploymentprofileazureadhybridjoined",
        "microsoft.intune.windowsupdateforbusinessfeatureupdateprofilewindows10",
        "microsoft.intune.windowsupdateforbusinessringupdateprofilewindows10",
        "microsoft.intune.antiviruspolicywindows10settingcatalog",
        "microsoft.intune.attacksurfacereductionrulespolicywindows10configmanager",
        "microsoft.intune.endpointdetectionandresponsepolicywindows10",
        "microsoft.intune.exploitprotectionpolicywindows10settingcatalog",
        "microsoft.intune.accountprotectionpolicy",
        "microsoft.intune.accountprotectionlocalusergroupmembershippolicy",
        "microsoft.intune.applicationcontrolpolicywindows10",
        "microsoft.intune.settingcatalogasrrulespolicywindows10",
    ],
    "Security & Compliance": [
        "microsoft.securityandcompliance.autosensitivitylabelpolicy",
        "microsoft.securityandcompliance.caseholdpolicy",
        "microsoft.securityandcompliance.caseholdrule",
        "microsoft.securityandcompliance.compliancecase",
        "microsoft.securityandcompliance.compliancesearch",
        "microsoft.securityandcompliance.compliancesearchaction",
        "microsoft.securityandcompliance.compliancetag",
        "microsoft.securityandcompliance.deviceconditionalaccesspolicy",
        "microsoft.securityandcompliance.deviceconfigurationpolicy",
        "microsoft.securityandcompliance.dlpcompliancepolicy",
        "microsoft.securityandcompliance.fileplanpropertyauthority",
        "microsoft.securityandcompliance.fileplanpropertycategory",
        "microsoft.securityandcompliance.fileplanpropertycitation",
        "microsoft.securityandcompliance.fileplanpropertydepartment",
        "microsoft.securityandcompliance.fileplanpropertyreferenceid",
        "microsoft.securityandcompliance.fileplanpropertysubcategory",
        "microsoft.securityandcompliance.protectionalert",
        "microsoft.securityandcompliance.retentioncompliancepolicy",
        "microsoft.securityandcompliance.retentioncompliancerule",
        "microsoft.securityandcompliance.retentioneventtype",
        "microsoft.securityandcompliance.securityfilter",
        "microsoft.securityandcompliance.supervisoryreviewpolicy",
        "microsoft.securityandcompliance.supervisoryreviewrule",
    ],
};

// Combine all presets into one "All Resources" list
function getAllResources() {
    const all = new Set();
    for (const preset of Object.values(RESOURCE_PRESETS)) {
        for (const r of preset) all.add(r);
    }
    return [...all].sort();
}

// --- Per-tenant snapshot state ---
const snapshotState = {
    source: { jobs: [], selectedSnapshotId: null, snapshotData: null, polling: null },
    dest:   { jobs: [], selectedSnapshotId: null, snapshotData: null, polling: null },
};

async function loadSnapshotJobs(side) {
    const token = side === "source" ? await getSourceToken() : await getDestToken();
    try {
        const result = await getSnapshotJobs(token);
        snapshotState[side].jobs = result.value || [];
    } catch (err) {
        if (err.tcmError) {
            showSetupGuidance(side, err.tcmError);
            return;
        }
        throw err;
    }
    renderSnapshotPanel(side);
}

async function triggerSnapshot(side, presetNames, displayName, individualTypes) {
    const token = side === "source" ? await getSourceToken() : await getDestToken();

    // Build resource list from selected presets + individual types
    let resources;
    if (presetNames.includes("All")) {
        resources = getAllResources();
    } else {
        const set = new Set();
        for (const name of presetNames) {
            for (const r of (RESOURCE_PRESETS[name] || [])) set.add(r);
        }
        if (individualTypes) {
            for (const t of individualTypes) set.add(t);
        }
        resources = [...set].sort();
    }

    const description = `Created by Tenant Config Compare`;

    try {
        await createSnapshot(token, displayName, description, resources);
    } catch (err) {
        if (err.tcmError) {
            showSetupGuidance(side, err.tcmError);
            return;
        }
        showError(side, "Failed to create snapshot: " + (err.message || JSON.stringify(err)));
        return;
    }

    // Reload jobs and start polling for completion
    await loadSnapshotJobs(side);
    startPolling(side);
}

function startPolling(side) {
    // Don't start duplicate polling
    if (snapshotState[side].polling) return;

    snapshotState[side].polling = setInterval(async () => {
        const hasRunning = snapshotState[side].jobs.some(
            j => j.status === "notStarted" || j.status === "running"
        );
        if (!hasRunning) {
            clearInterval(snapshotState[side].polling);
            snapshotState[side].polling = null;
            return;
        }
        await loadSnapshotJobs(side);
    }, 30000);
}

async function selectSnapshot(side, jobId) {
    const job = snapshotState[side].jobs.find(j => j.id === jobId);
    if (!job || !job.resourceLocation) return;

    // Parse snapshot ID from resourceLocation
    const match = job.resourceLocation.match(/\('([^']+)'\)/);
    if (!match) return;
    const snapshotId = match[1];

    const token = side === "source" ? await getSourceToken() : await getDestToken();
    try {
        const data = await getSnapshot(token, snapshotId);
        snapshotState[side].selectedSnapshotId = jobId;
        snapshotState[side].snapshotData = data;
    } catch (err) {
        showError(side, "Failed to load snapshot: " + (err.message || JSON.stringify(err)));
        return;
    }
    renderSnapshotPanel(side);
    updateCompareButton();
}

function deselectSnapshot(side) {
    snapshotState[side].selectedSnapshotId = null;
    snapshotState[side].snapshotData = null;
    renderSnapshotPanel(side);
    updateCompareButton();
}

function getSnapshotSummary(snapshotData) {
    if (!snapshotData || !snapshotData.resources) return {};
    const counts = {};
    for (const resource of snapshotData.resources) {
        const type = resource.resourceType || "unknown";
        // Group by workload (first two segments: microsoft.exchange → Exchange)
        const parts = type.split(".");
        const workload = parts.length >= 2 ? capitalize(parts[1]) : type;
        counts[workload] = (counts[workload] || 0) + 1;
    }
    return counts;
}
