// diff.js — Property-level snapshot comparison engine

// Resource types that are entity inventories, not configuration.
// Comparing these across dev/prod is pure noise — every tenant has
// different users, groups, apps, and service principals.
const ENTITY_RESOURCE_TYPES = new Set([
    "microsoft.entra.user",
    "microsoft.entra.group",
    "microsoft.entra.serviceprincipal",
    "microsoft.entra.application",
    "microsoft.teams.user",
    "microsoft.teams.onlinevoiceuser",
    "microsoft.teams.callqueue",
]);

// Properties to ignore during comparison — these are identity/metadata
// that will always differ between tenants, not actual configuration.
const IGNORED_PROPERTIES = new Set([
    // Identity — tenant-specific GUIDs
    "id", "objectId", "identity", "principalId", "tenantId",
    // Display/naming — we match by displayName already, and naming
    // conventions vary by org. The user wants to compare configs, not names.
    "displayName", "displayname", "name", "mailNickname", "userPrincipalName",
    "mail", "description",
    // Timestamps — always different
    "createdDateTime", "modifiedDateTime", "deletedDateTime",
    "createdOn", "lastModifiedDateTime", "lastUpdatedDateTime",
    "whenCreated", "whenChanged",
    // Actor/origin metadata
    "createdBy", "lastModifiedBy", "createdByAppId",
    // Version metadata
    "version", "@odata.type",
]);

// Property name patterns to ignore (regex, case-insensitive)
const IGNORED_PATTERNS = [
    /^@odata\./,       // OData metadata annotations
    /guid$/i,          // properties ending in "guid"
    /objectid$/i,      // properties ending in "objectid"
];

function _isIgnoredProp(key) {
    if (IGNORED_PROPERTIES.has(key)) return true;
    return IGNORED_PATTERNS.some(p => p.test(key));
}

// Attempt to normalize GUIDs out of values so tenant-specific references
// don't cause false diffs. Returns the value with GUIDs replaced by a
// placeholder. Only used for comparison, not display.
const GUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function _normalizeForCompare(val) {
    if (val == null) return val;
    if (typeof val === "string") return val.replace(GUID_PATTERN, "<GUID>");
    if (typeof val === "object") return JSON.stringify(val).replace(GUID_PATTERN, "<GUID>");
    return val;
}

/**
 * Compare two snapshots and return a structured diff.
 * @param {Object} sourceData - Source snapshot (.resources array)
 * @param {Object} destData - Destination snapshot (.resources array)
 * @param {Object} [options] - { ignoreGuidValues: true, hideEntities: true }
 * @returns {Object} Diff result keyed by resourceType
 */
function diffSnapshots(sourceData, destData, options) {
    const opts = Object.assign({ ignoreGuidValues: true, hideEntities: true }, options);
    const srcByType = _groupByType(sourceData);
    const dstByType = _groupByType(destData);
    const allTypes = [...new Set([...Object.keys(srcByType), ...Object.keys(dstByType)])].sort();

    const result = {};
    for (const type of allTypes) {
        if (opts.hideEntities && ENTITY_RESOURCE_TYPES.has(type)) continue;
        result[type] = _diffType(srcByType[type] || [], dstByType[type] || [], opts);
    }
    return result;
}

function _groupByType(data) {
    const map = {};
    if (!data || !data.resources) return map;
    for (const r of data.resources) {
        const t = r.resourceType || "unknown";
        (map[t] || (map[t] = [])).push(r);
    }
    return map;
}

/**
 * Compare resources of the same type. Matches by displayName.
 */
function _diffType(srcArr, dstArr, opts) {
    const srcMap = _indexByName(srcArr);
    const dstMap = _indexByName(dstArr);
    const allNames = [...new Set([...Object.keys(srcMap), ...Object.keys(dstMap)])].sort();

    const matched = [], sourceOnly = [], destOnly = [];
    for (const name of allNames) {
        const s = srcMap[name], d = dstMap[name];
        if (s && d) {
            const diffs = _diffProps(s.properties || {}, d.properties || {}, opts);
            matched.push({
                displayName: name,
                source: s,
                dest: d,
                propertyDiffs: diffs,
                identical: diffs.length === 0
            });
        } else if (s) {
            sourceOnly.push({ displayName: name, resource: s });
        } else {
            destOnly.push({ displayName: name, resource: d });
        }
    }

    return {
        matched, sourceOnly, destOnly,
        sourceCount: srcArr.length,
        destCount: dstArr.length,
        hasDifferences: sourceOnly.length > 0 || destOnly.length > 0 || matched.some(m => !m.identical)
    };
}

function _indexByName(arr) {
    const map = {};
    for (const r of arr) {
        let name = r.displayName || "(unnamed)";
        if (map[name]) {
            let i = 2;
            while (map[`${name} (${i})`]) i++;
            name = `${name} (${i})`;
        }
        map[name] = r;
    }
    return map;
}

/**
 * Compare two property objects. Skips metadata/identity properties
 * and optionally normalizes GUID values so tenant-specific references
 * don't cause false positives.
 */
function _diffProps(srcProps, dstProps, opts) {
    const allKeys = [...new Set([...Object.keys(srcProps), ...Object.keys(dstProps)])].sort();
    const diffs = [];
    for (const key of allKeys) {
        if (_isIgnoredProp(key)) continue;

        const inSrc = key in srcProps, inDst = key in dstProps;
        if (!inSrc) {
            diffs.push({ property: key, status: "dest-only", destValue: dstProps[key] });
        } else if (!inDst) {
            diffs.push({ property: key, status: "source-only", sourceValue: srcProps[key] });
        } else {
            const eq = opts.ignoreGuidValues
                ? _valEq(_normalizeForCompare(srcProps[key]), _normalizeForCompare(dstProps[key]))
                : _valEq(srcProps[key], dstProps[key]);
            if (!eq) {
                diffs.push({ property: key, status: "changed", sourceValue: srcProps[key], destValue: dstProps[key] });
            }
        }
    }
    return diffs;
}

function _valEq(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a == b;
    if (typeof a !== typeof b) return false;
    if (typeof a === "object") return JSON.stringify(a) === JSON.stringify(b);
    return String(a) === String(b);
}

function formatDiffValue(val) {
    if (val === null || val === undefined) return "(empty)";
    if (typeof val === "object") return JSON.stringify(val, null, 2);
    return String(val);
}

/**
 * Export full diff results to CSV. Includes ALL data (unfiltered)
 * so the user can pivot/filter in Excel.
 *
 * Columns: Workload, ResourceType, ResourceName, Status, Property,
 *          SourceValue, DestValue
 */
function exportDiffCsv(diff) {
    const rows = [["Workload", "ResourceType", "ResourceName", "Status", "Property", "SourceValue", "DestValue"]];

    for (const [type, td] of Object.entries(diff).sort()) {
        const parts = type.split(".");
        const workload = parts.length >= 2 ? capitalize(parts[1]) : "Other";
        const shortType = parts.slice(2).join(".") || type;

        // Source-only resources
        for (const r of td.sourceOnly) {
            rows.push([workload, shortType, r.displayName, "source-only", "", "", ""]);
        }

        // Dest-only resources
        for (const r of td.destOnly) {
            rows.push([workload, shortType, r.displayName, "dest-only", "", "", ""]);
        }

        // Matched — identical
        for (const m of td.matched.filter(x => x.identical)) {
            rows.push([workload, shortType, m.displayName, "identical", "", "", ""]);
        }

        // Matched — differs (one row per differing property)
        for (const m of td.matched.filter(x => !x.identical)) {
            if (m.propertyDiffs.length === 0) {
                rows.push([workload, shortType, m.displayName, "identical", "", "", ""]);
            }
            for (const d of m.propertyDiffs) {
                const sv = d.status === "dest-only" ? "" : _csvVal(d.sourceValue);
                const dv = d.status === "source-only" ? "" : _csvVal(d.destValue);
                rows.push([workload, shortType, m.displayName, d.status, d.property, sv, dv]);
            }
        }
    }

    const csv = rows.map(r => r.map(_csvEscape).join(",")).join("\r\n");
    const bom = "\uFEFF"; // UTF-8 BOM so Excel opens correctly
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tenant-config-diff-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function _csvVal(val) {
    if (val === null || val === undefined) return "";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
}

function _csvEscape(val) {
    const s = String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}
