(function () {

    "use strict";

    const $ = (selector, root = document) => root.querySelector(selector);

    const $$ = (selector, root = document) =>

        Array.from(root.querySelectorAll(selector));

    const state = {

        role: null,

        personId: null,

        people: [],

        donations: [],

        claims: [],

        clock: null,

        dashboard: null,

        view: "dashboard"

    };

    const API = window.API;

    if (!API) {

        console.error("API helper is missing. Check static/js/api.js.");

        return;

    }

    // --------------------------------------------------

    // GENERAL HELPERS

    // --------------------------------------------------

    function escapeHtml(value) {

        return String(value ?? "").replace(/[&<>"']/g, character => ({

            "&": "&amp;",

            "<": "&lt;",

            ">": "&gt;",

            '"': "&quot;",

            "'": "&#39;"

        })[character]);

    }

    function formatNumber(value) {

        const number = Number(value);

        return Number.isFinite(number)

            ? number.toLocaleString("en-IN", {

                maximumFractionDigits: 2

            })

            : "—";

    }

    function formatDate(value) {

        if (!value) return "—";

        const date = new Date(String(value).replace(" ", "T"));

        if (Number.isNaN(date.getTime())) return String(value);

        return date.toLocaleString("en-IN", {

            day: "2-digit",

            month: "short",

            year: "numeric",

            hour: "2-digit",

            minute: "2-digit",

            hour12: true

        });

    }

    function inputDate(value) {

        if (!value) return "";

        return String(value)

            .replace(" ", "T")

            .slice(0, 16);

    }

    function currentPerson() {

        return state.people.find(person =>

            String(person.id) === String(state.personId)

        ) || null;

    }

    function showNotice(message, type = "success") {

        const notice = $("#globalNotice");

        if (!notice) return;

        notice.className = "global-notice";

        if (type !== "success") notice.classList.add(type);

        notice.textContent = message;

        notice.scrollIntoView({

            behavior: "smooth",

            block: "nearest"

        });

    }

    function errorMessage(error) {

        return error?.message || "Something went wrong. Please try again.";

    }

    function showError(error) {

        console.error(error);

        showNotice(errorMessage(error), "error");

    }

    function openDialog(id) {

        const dialog = document.getElementById(id);

        if (!dialog) return;

        if (typeof dialog.showModal === "function") {

            if (!dialog.open) dialog.showModal();

        } else {

            dialog.setAttribute("open", "");

        }

    }

    function closeDialog(id) {

        const dialog = document.getElementById(id);

        if (dialog?.open) dialog.close();

    }

    function listFromResponse(data, keys = []) {

        if (Array.isArray(data)) return data;

        if (data && typeof data === "object") {

            for (const key of keys) {

                if (Array.isArray(data[key])) return data[key];

            }

            if (Array.isArray(data.results)) return data.results;

        }

        return [];

    }

    function statusBadge(status) {

        const value = String(status || "UNKNOWN").toUpperCase();

        const className = value.toLowerCase().replaceAll("\\\_", "-");

        return `<span class="status-badge ${escapeHtml(className)}">${escapeHtml(value.replaceAll("\\\_", " "))}</span>`;

    }

    function pageHeading(label, title, description, actions = "") {

        return `

            <div class="page-heading">

                <div>

                    <div class="eyebrow">${escapeHtml(label)}</div>

                    <h1>${escapeHtml(title)}</h1>

                    <p>${escapeHtml(description)}</p>

                </div>

                <div class="heading-actions">${actions}</div>

            </div>

        `;

    }

    function metricCard(label, value, footer, color = "green", symbol = "●") {

        return `

            <article class="metric-card">

                <div class="metric-top">

                    <span class="metric-label">${escapeHtml(label)}</span>

                    <span class="metric-icon ${escapeHtml(color)}">${escapeHtml(symbol)}</span>

                </div>

                <div class="metric-value">${formatNumber(value)}</div>

                <div class="metric-footer">${escapeHtml(footer)}</div>

            </article>

        `;

    }

    function setLoading(loading) {

        $("#appLoading")?.classList.toggle("hidden", !loading);

    }

    // --------------------------------------------------

    // LOAD DATA

    // --------------------------------------------------

    async function loadPeople() {

    const response = await API.get("/api/people/");

    const donors = Array.isArray(response?.donors)

        ? response.donors.map(person => ({

            ...person,

            role: "donor"

        }))

        : [];

    const volunteers = Array.isArray(response?.volunteers)

        ? response.volunteers.map(person => ({

            ...person,

            role: "volunteer"

        }))

        : [];

    const people = Array.isArray(response?.people)

        ? response.people

        : [];

    state.people = [...donors, ...volunteers, ...people];

}

    async function loadClock() {

        const response = await API.get("/api/clock/");

        state.clock = response.current_time || response.clock || null;

    }

    async function loadDonations() {

        const response = await API.get("/api/donations/");

        state.donations = listFromResponse(response, ["donations"]);

    }

    async function loadClaims()

    {

        try {

            let url = "/api/claims/";

            if (state.role === "volunteer" && state.personId) {

                const params = new URLSearchParams({

                    volunteer_id: String(state.personId)

                });

                url += `?${params.toString()}`;

            }

            const response = await API.get(url);

            state.claims = listFromResponse(

                response,

                ["claims"]

            );

            return true;

        } catch (error) {

            state.claims = [];

            console.error("Unable to load claims:", error);

            throw error;

        }

    }

    async function loadDashboard() {

        try {

            state.dashboard = await API.get("/api/dashboard/");

            return true;

        } catch (error) {

            state.dashboard = null;

            console.warn("Dashboard endpoint unavailable:", error);

            return false;

        }

    }

    async function loadInitialData() {

        await Promise.all([

            loadPeople(),

            loadClock(),

            loadDonations()

        ]);

        await Promise.all([

            loadClaims(),

            loadDashboard()

        ]);

        updateIdentity();

        updateHeaderClock();

        renderCurrentView();

    }

    async function refreshAfterMutation() {

        await Promise.all([

            loadClock(),

            loadDonations(),

            loadClaims(),

            loadDashboard()

        ]);

        updateHeaderClock();

        renderCurrentView();

    }

    // --------------------------------------------------

    // PROFILE SELECTION

    // --------------------------------------------------

    function peopleForRole(role) {

        return state.people.filter(person => {

            const type = String(person.role || person.type || "").toLowerCase();

            const isVolunteer = type === "volunteer" ||

                (person.capacity_kg !== undefined && person.zone === undefined);

            return role === "volunteer" ? isVolunteer : !isVolunteer;

        });

    }

    function populatePeople() {

        const role = $("#personRole").value;

        const select = $("#personId");

        const people = peopleForRole(role);

        select.innerHTML = people.map(person => `

            <option value="${escapeHtml(person.id)}">

                ${escapeHtml(person.name || person.id)}

                (${escapeHtml(person.id)})

            </option>

        `).join("");

        if (!people.length) {

            select.innerHTML = '<option value="">No profiles available</option>';

        }

        updatePersonDescription();

    }

    function updatePersonDescription() {

        const person = state.people.find(item =>

            String(item.id) === String($("#personId").value)

        );

        const description = $("#personDescription");

        if (!person) {

            description.textContent = "No profile selected.";

            return;

        }

        description.textContent = person.capacity_kg !== undefined

            ? `Volunteer capacity: ${person.capacity_kg} kg.`

            : `Donor zone: ${person.zone || "Not specified"}.`;

    }

    async function selectPerson(role, id)

    {

        state.role = role;

        state.personId = id;

        // Open the relevant page for the selected workspace.

        state.view = role === "donor" ? "donations" : "claims";

        closeDialog("personDialog");

        setLoading(true);

        try {

            await refreshAfterMutation();

            updateIdentity();

            showNotice(

                role === "donor"

                    ? "Switched to donor workspace. Showing your donations."

                    : "Switched to volunteer workspace. Showing your claims."

            );

        } catch (error) {

            showError(error);

        } finally {

            setLoading(false);

        }

    }

    function updateIdentity() {

        const person = currentPerson();

        const name = person?.name || "Choose a profile";

        const initial = name.charAt(0).toUpperCase() || "G";

        $("#currentPersonName").textContent = name;

        $("#currentPersonRole").textContent = state.role || "Select workspace";

        $("#topAvatar").textContent = initial;

        $("#topAvatarSmall").textContent = initial;

        $("#topbarGreeting").textContent = person

            ? `Welcome back, ${name}`

            : "Welcome to your network";

    }

    // --------------------------------------------------

    // NAVIGATION

    // --------------------------------------------------

    function showView(view) {

        state.view = view;

        $$(".page-view").forEach(element => {

            element.classList.add("hidden");

        });

        const target = document.getElementById(`${view}View`);

        target?.classList.remove("hidden");

        $$(".nav-item[data-view]").forEach(button => {

            button.classList.toggle("active", button.dataset.view === view);

        });

        const titles = {

            dashboard: "Overview",

            donations: "Donations",

            claims: "My claims",

            reports: "Impact reports",

            clock: "Simulated clock"

        };

        $("#breadcrumbPage").textContent = titles[view] || "Overview";

        renderCurrentView();

    }

    function renderCurrentView() {

        updateHeaderClock();

        switch (state.view) {

            case "donations":

                renderDonations();

                break;

            case "claims":

                renderClaims();

                break;

            case "reports":

                renderReports();

                break;

            case "clock":

                renderClock();

                break;

            default:

                renderDashboard();

        }

    }

    function updateHeaderClock() {

        $("#headerClock").textContent = state.clock

            ? formatDate(state.clock)

            : "Unavailable";

    }

    // --------------------------------------------------

    // OVERVIEW

    // --------------------------------------------------

    function renderDashboard() {

        const openDonations = state.donations.filter(donation =>

            donation.status === "OPEN" &&

            !donation.is_cancelled

        );

        const availableKg = openDonations.reduce(

            (sum, donation) => sum + Number(donation.remaining_kg || 0), 0

        );

        const collectedKg = state.claims

            .filter(claim => claim.status === "COLLECTED")

            .reduce((sum, claim) => sum + Number(claim.quantity_kg || 0), 0);

        const activeClaims = state.claims.filter(claim =>

            claim.status === "ACTIVE"

        ).length;

        const greeting = state.role === "donor"

            ? "Share your surplus with purpose."

            : "Help good food find a home.";

        const recentDonations = [...state.donations].slice(0, 5);

        $("#dashboardView").innerHTML = `

            ${pageHeading(

                "NETWORK OVERVIEW",

                "Food deserves a second chance.",

                "Track donations, coordinate pickups, and measure the food rescued."

            )}

            <section class="dashboard-feature">

                <div>

                    <div class="eyebrow">${escapeHtml(state.role || "FOOD RESCUE")} WORKSPACE</div>

                    <h2>${escapeHtml(greeting)}</h2>

                    <p>

                        Every successful pickup helps reduce food waste and makes

                        surplus food available to the people who need it.

                    </p>

                    <div class="heading-actions">

                        ${state.role === "donor"

                            ? '<button class="button primary" id="dashboardCreateDonation">+ List food</button>'

                            : '<button class="button primary" id="dashboardBrowseDonations">Browse donations</button>'}

                        <button class="button secondary" id="dashboardRefresh">Refresh data</button>

                    </div>

                </div>

                <div class="feature-art" aria-hidden="true">♻</div>

            </section>

            <div class="metrics-grid">

                ${metricCard("Available food", availableKg, "kg available to claim", "green", "♧")}

                ${metricCard("Collected food", collectedKg, "kg successfully collected", "blue", "✓")}

                ${metricCard("Open donations", openDonations.length, "currently available", "gold", "▤")}

                ${metricCard("Active claims", activeClaims, "awaiting collection", "coral", "↗")}

            </div>

            <article class="panel table-panel">

                <div class="panel-heading">

                    <div>

                        <div class="eyebrow">LATEST ACTIVITY</div>

                        <h2>Recent donations</h2>

                        <p>Live data returned by your Django API.</p>

                    </div>

                    <button class="panel-link" id="dashboardViewAll">View all donations →</button>

                </div>

                <div class="table-scroll">

                    <table>

                        <thead>

                            <tr>

                                <th>Donation</th>

                                <th>Zone</th>

                                <th>Available</th>

                                <th>Status</th>

                                <th></th>

                            </tr>

                        </thead>

                        <tbody>

                            ${recentDonations.length

                                ? recentDonations.map(donation => `

                                    <tr>

                                        <td>

                                            <div class="table-title">

                                                <span class="food-icon">♧</span>

                                                <div>

                                                    <strong>${escapeHtml(donation.description)}</strong>

                                                    <small>${escapeHtml(donation.id)}</small>

                                                </div>

                                            </div>

                                        </td>

                                        <td>${escapeHtml(donation.zone || donation.donor_zone || "—")}</td>

                                        <td>${formatNumber(donation.remaining_kg)} kg</td>

                                        <td>${statusBadge(donation.status)}</td>

                                        <td><button class="button soft small" data-details="${escapeHtml(donation.id)}">Details</button></td>

                                    </tr>

                                `).join("")

                                : `<tr><td colspan="5"><div class="empty-state"><h3>No donations returned</h3><p>Check your server or create a donation.</p></div></td></tr>`

                            }

                        </tbody>

                    </table>

                </div>

            </article>

        `;

        $("#dashboardCreateDonation")?.addEventListener("click", openDonationForm);

        $("#dashboardBrowseDonations")?.addEventListener("click", () => showView("donations"));

        $("#dashboardViewAll")?.addEventListener("click", () => showView("donations"));

        $("#dashboardRefresh")?.addEventListener("click", async () => {

            try {

                await refreshAfterMutation();

                showNotice("Data refreshed from the server.");

            } catch (error) {

                showError(error);

            }

        });

        bindDonationDetailButtons($("#dashboardView"));

    }

    // --------------------------------------------------

    // DONATIONS

    // --------------------------------------------------

    function renderDonations() {

        const isDonor = state.role === "donor";

        $("#donationsView").innerHTML = `

            ${pageHeading(

                "FOOD INVENTORY",

                "Donations",

                isDonor

                    ? "Publish and manage your surplus food."

                    : "Discover available food and check pickup eligibility.",

                isDonor

                    ? '<button class="button primary" id="createDonationBtn">+ List donation</button>'

                    : ""

            )}

            <div class="filter-bar">

                <input id="donationSearch" type="search" placeholder="Search food or donation ID..." aria-label="Search donations">

                <select id="donationStatusFilter" aria-label="Filter donations by status">

                    <option value="">All statuses</option>

                    <option value="OPEN">Open</option>

                    <option value="FULLY_CLAIMED">Fully claimed</option>

                    <option value="EXPIRED">Expired</option>

                    <option value="CANCELLED">Cancelled</option>

                </select>

            </div>

            <div id="donationGrid" class="donation-grid"></div>

        `;

        $("#createDonationBtn")?.addEventListener("click", openDonationForm);

        $("#donationSearch").addEventListener("input", filterDonations);

        $("#donationStatusFilter").addEventListener("change", filterDonations);

        filterDonations();

    }

    function filterDonations() {

        const query = ($("#donationSearch")?.value || "").toLowerCase().trim();

        const status = $("#donationStatusFilter")?.value || "";

        let donations = state.donations.filter(donation => {

            const text = `${donation.description || ""} ${donation.id || ""} ${donation.donor_name || ""}`.toLowerCase();

            return text.includes(query) && (!status || donation.status === status);

        });

        if (state.role === "donor" && state.personId) {

            donations = donations.filter(donation =>

                String(donation.donor_id) === String(state.personId)

            );

        }

        const grid = $("#donationGrid");

        if (!grid) return;

        if (!donations.length) {

            grid.innerHTML = `

                <div class="panel empty-state" style="grid-column:1/-1">

                    <h3>No matching donations</h3>

                    <p>Try changing the filters or refresh the data.</p>

                </div>

            `;

            return;

        }

        grid.innerHTML = donations.map(donation => {

            const isOpen = donation.status === "OPEN" &&

                Number(donation.remaining_kg) > 0;

            return `

                <article class="donation-card">

                    <div class="donation-card-top">

                        <span class="food-icon">♧</span>

                        ${statusBadge(donation.status)}

                    </div>

                    <h3>${escapeHtml(donation.description)}</h3>

                    <div class="donor-name">

                        ${escapeHtml(donation.donor_name || donation.donor_id || "Food donor")}

                        · ${escapeHtml(donation.zone || donation.donor_zone || "Zone not specified")}

                    </div>

                    <div class="donation-quantity">

                        <strong>${formatNumber(donation.remaining_kg)}</strong>

                        <span>kg available</span>

                    </div>

                    <div class="donation-info">

                        <div class="donation-info-row">

                            <span>Donation ID</span>

                            <strong>${escapeHtml(donation.id)}</strong>

                        </div>

                        <div class="donation-info-row">

                            <span>Listed quantity</span>

                            <strong>${formatNumber(donation.quantity_kg)} kg</strong>

                        </div>

                        <div class="donation-info-row">

                            <span>Pickup starts</span>

                            <strong>${escapeHtml(formatDate(donation.pickup_from))}</strong>

                        </div>

                        <div class="donation-info-row">

                            <span>Pickup ends</span>

                            <strong>${escapeHtml(formatDate(donation.pickup_until))}</strong>

                        </div>

                    </div>

                    <div class="donation-card-actions">

                        <button class="button secondary small" data-details="${escapeHtml(donation.id)}">Details</button>

                        ${state.role === "volunteer" && isOpen

                            ? `<button class="button primary small" data-claim="${escapeHtml(donation.id)}">Claim food</button>`

                            : ""}

                        ${state.role === "donor" &&

                            String(donation.donor_id) === String(state.personId) &&

                            donation.status === "OPEN"

                            ? `<button class="button danger small" data-cancel-donation="${escapeHtml(donation.id)}">Cancel donation</button>`

                            : ""}

                    </div>

                </article>

            `;

        }).join("");

        bindDonationDetailButtons(grid);

        $$("[data-claim]", grid).forEach(button => {

            button.addEventListener("click", () => {

                const donation = state.donations.find(item =>

                    String(item.id) === String(button.dataset.claim)

                );

                openClaimForm(donation);

            });

        });

        $$("[data-cancel-donation]", grid).forEach(button => {

            button.addEventListener("click", () =>

                cancelDonation(button.dataset.cancelDonation)

            );

        });

    }

    function bindDonationDetailButtons(root = document) {

        $$("[data-details]", root).forEach(button => {

            button.addEventListener("click", () =>

                openDonationDetails(button.dataset.details)

            );

        });

    }

    // --------------------------------------------------

    // CLAIMS

    // --------------------------------------------------

    function renderClaims() {

        const rows = state.claims.map(claim => `

            <tr>

                <td>

                    <div class="table-title">

                        <span class="food-icon">♧</span>

                        <div>

                            <strong>${escapeHtml(claim.donation_description || claim.donation_id || "Donation")}</strong>

                            <small>Claim #${escapeHtml(claim.id)}</small>

                        </div>

                    </div>

                </td>

                <td>${formatNumber(claim.quantity_kg)} kg</td>

                <td>${escapeHtml(formatDate(claim.planned_pickup_at))}</td>

                <td>${statusBadge(claim.status)}</td>

                <td>

                    <div class="row-actions">

                        ${claim.status === "ACTIVE"

                            ? `<button class="button soft small" data-collect="${escapeHtml(claim.id)}">Collect</button>

                               <button class="text-button danger-text" data-cancel-claim="${escapeHtml(claim.id)}">Cancel</button>`

                            : ""}

                    </div>

                </td>

            </tr>

        `).join("");

        $("#claimsView").innerHTML = `

            ${pageHeading(

                "PICKUP ACTIVITY",

                "My claims",

                "Track claims and record completed food pickups."

            )}

            <article class="panel table-panel">

                <div class="panel-heading">

                    <div>

                        <div class="eyebrow">${state.claims.length} CLAIMS</div>

                        <h2>Pickup activity</h2>

                    </div>

                    <select id="claimStatusFilter" class="filter-select">

                        <option value="">All statuses</option>

                        <option value="ACTIVE">Active</option>

                        <option value="COLLECTED">Collected</option>

                        <option value="CANCELLED">Cancelled</option>

                        <option value="MISSED">Missed</option>

                    </select>

                </div>

                <div class="table-scroll">

                    <table>

                        <thead>

                            <tr>

                                <th>Donation</th>

                                <th>Quantity</th>

                                <th>Planned pickup</th>

                                <th>Status</th>

                                <th>Actions</th>

                            </tr>

                        </thead>

                        <tbody id="claimRows">

                            ${rows || `<tr><td colspan="5"><div class="empty-state compact"><h3>No claims returned</h3><p>Browse donations to get started.</p></div></td></tr>`}

                        </tbody>

                    </table>

                </div>

            </article>

        `;

        $("#claimStatusFilter").addEventListener("change", event => {

            const filter = event.target.value;

            $$("#claimRows tr").forEach(row => {

                row.classList.toggle(

                    "hidden",

                    Boolean(filter) && !row.textContent.includes(filter)

                );

            });

        });

        $$("[data-collect]", $("#claimsView")).forEach(button => {

            button.addEventListener("click", () =>

                mutateClaim(button.dataset.collect, "collect")

            );

        });

        $$("[data-cancel-claim]", $("#claimsView")).forEach(button => {

            button.addEventListener("click", () =>

                mutateClaim(button.dataset.cancelClaim, "cancel")

            );

        });

    }

    // --------------------------------------------------

    // IMPACT REPORTS

    // --------------------------------------------------

    function renderReports() {

        const totals = state.dashboard?.totals || {};

        const reconciliation = state.dashboard?.reconciliation || {};

        const donors = state.dashboard?.collected_by_donor || [];

        const volunteers = state.dashboard?.volunteer_stats || [];

        if (!state.dashboard) {

            $("#reportsView").innerHTML = `

                ${pageHeading(

                    "IMPACT REPORTS",

                    "The good that adds up.",

                    "Impact totals must come from the backend."

                )}

                <article class="panel">

                    <h2>Impact report unavailable</h2>

                    <p class="muted">

                        The GET /api/dashboard/ endpoint is not available or

                        returned an error. No sample totals are displayed.

                        Implement the endpoint in Django to enable this report.

                    </p>

                    <button class="button primary" id="refreshReportBtn">Try again</button>

                </article>

            `;

            $("#refreshReportBtn").addEventListener("click", async () => {

                try {

                    await loadDashboard();

                    renderReports();

                } catch (error) {

                    showError(error);

                }

            });

            return;

        }

        $("#reportsView").innerHTML = `

            ${pageHeading(

                "IMPACT REPORTS",

                "The good that adds up.",

                "A clear view of food rescued across the network.",

                '<button class="button secondary" id="refreshReportBtn">Refresh report</button>'

            )}

            <div class="metrics-grid report-metrics">

                ${metricCard("Collected food", totals.collected_kg, "Collected", "green")}

                ${metricCard("Missed food", totals.missed_kg, "Missed claims", "coral")}

                ${metricCard("Wasted food", totals.wasted_kg, "Expired food", "gold")}

                ${metricCard("Still open", totals.still_open_kg, "Available food", "blue")}

            </div>

            <article class="panel reconciliation-panel">

                <div>

                    <div class="eyebrow">NETWORK RECONCILIATION</div>

                    <h2>Every kilogram has a destination</h2>

                    <p class="muted">

                        Listed ${escapeHtml(totals.listed_kg ?? "—")} kg =

                        collected ${escapeHtml(totals.collected_kg ?? "—")} +

                        missed ${escapeHtml(totals.missed_kg ?? "—")} +

                        wasted ${escapeHtml(totals.wasted_kg ?? "—")} +

                        in progress ${escapeHtml(totals.in_progress_kg ?? "—")} +

                        still open ${escapeHtml(totals.still_open_kg ?? "—")} kg.

                    </p>

                </div>

                <div class="reconcile-status ${reconciliation.balanced ? "balanced" : "unbalanced"}">

                    <strong>${reconciliation.balanced ? "✓ Balanced" : "Unbalanced"}</strong>

                    <span>Difference: ${escapeHtml(reconciliation.difference_kg ?? "—")} kg</span>

                </div>

            </article>

            <div class="dashboard-lower report-lists">

                <article class="panel">

                    <div class="panel-heading"><h2>Collected by donor</h2></div>

                    ${donors.length ? `<div class="rank-list">${donors.map(item => `

                        <div class="rank-row">

                            <div>

                                <strong>${escapeHtml(item.donor_name)}</strong>

                                <small>${escapeHtml(item.donor_id)}</small>

                            </div>

                            <strong>${formatNumber(item.collected_kg)} kg</strong>

                        </div>`).join("")}</div>`

                        : '<div class="empty-inline">No donor statistics returned.</div>'}

                </article>

                <article class="panel">

                    <div class="panel-heading"><h2>Volunteer impact</h2></div>

                    ${volunteers.length ? `<div class="rank-list">${volunteers.map(item => `

                        <div class="rank-row">

                            <div>

                                <strong>${escapeHtml(item.volunteer_name)}</strong>

                                <small>${formatNumber(item.missed_claim_count)} missed claims</small>

                            </div>

                            <strong>${formatNumber(item.collected_kg)} kg</strong>

                        </div>`).join("")}</div>`

                        : '<div class="empty-inline">No volunteer statistics returned.</div>'}

                </article>

            </div>

        `;

        $("#refreshReportBtn").addEventListener("click", async () => {

            try {

                await loadDashboard();

                renderReports();

                if (state.dashboard) showNotice("Impact report refreshed.");

            } catch (error) {

                showError(error);

            }

        });

    }

    // --------------------------------------------------

    // SIMULATED CLOCK

    // --------------------------------------------------

    function renderClock() {

        $("#clockView").innerHTML = `

            ${pageHeading(

                "SIMULATED TIME",

                "Control the clock",

                "Time-dependent rules use the backend simulated clock."

            )}

            <div class="clock-feature panel">

                <div class="clock-feature-icon">◷</div>

                <div class="eyebrow">CURRENT SIMULATED TIME</div>

                <div class="clock-current">${escapeHtml(state.clock || "Unavailable")}</div>

                <p class="muted">

                    Advancing time may cause overdue claims to become missed.

                </p>

                <form id="clockForm" class="clock-form">

                    <label for="clockAdvanceInput">Advance to

                        <input id="clockAdvanceInput" type="datetime-local"

                               name="current_time"

                               min="${escapeHtml(inputDate(state.clock))}"

                               value="${escapeHtml(inputDate(state.clock))}" required>

                    </label>

                    <button class="button primary" type="submit">Advance clock</button>

                </form>

            </div>

        `;

        $("#clockForm").addEventListener("submit", advanceClock);

    }

    // --------------------------------------------------

    // CREATE DONATION

    // --------------------------------------------------

    function openDonationForm() {

        if (state.role !== "donor") {

            showNotice("Switch to a donor workspace first.", "error");

            return;

        }

        if (!state.personId) {

            showNotice("Select a donor profile first.", "error");

            openDialog("personDialog");

            return;

        }

        const form = $("#donationForm");

        form.reset();

        const now = inputDate(state.clock);

        form.elements.pickup_from.min = now;

        form.elements.pickup_until.min = now;

        form.elements.pickup_from.value = now;

        if (now) {

            const date = new Date(now);

            date.setHours(date.getHours() + 2);

            form.elements.pickup_until.value = inputDate(

                date.getFullYear() + "-" +

                String(date.getMonth() + 1).padStart(2, "0") + "-" +

                String(date.getDate()).padStart(2, "0") + "T" +

                String(date.getHours()).padStart(2, "0") + ":" +

                String(date.getMinutes()).padStart(2, "0")

            );

        }

        openDialog("donationDialog");

    }

    async function createDonation(event) {

        event.preventDefault();

        if (state.role !== "donor" || !state.personId) {

            showNotice("Choose a donor profile first.", "error");

            return;

        }

        const form = event.currentTarget;

        const payload = {

            donor_id: String(state.personId),

            description: form.elements.description.value.trim(),

            quantity_kg: Number(form.elements.quantity_kg.value),

            pickup_from: form.elements.pickup_from.value,

            pickup_until: form.elements.pickup_until.value

        };

        if (!Number.isInteger(payload.quantity_kg) || payload.quantity_kg < 1) {

            showNotice("Enter a positive whole-number quantity.", "error");

            return;

        }

        if (!(payload.pickup_from < payload.pickup_until)) {

            showNotice("Pickup start must be before pickup end.", "error");

            return;

        }

        try {

            await API.post("/api/donations/", payload);

            closeDialog("donationDialog");

            showNotice("Donation created successfully.");

            await refreshAfterMutation();

        } catch (error) {

            showError(error);

        }

    }

    // --------------------------------------------------

    // CLAIM ELIGIBILITY AND SUBMISSION

    // --------------------------------------------------

    function openClaimForm(donation) {

        if (!donation || state.role !== "volunteer") {

            showNotice("Select a volunteer profile first.", "error");

            return;

        }

        if (!state.personId) {

            openDialog("personDialog");

            return;

        }

        const form = $("#claimForm");

        form.reset();

        form.elements.donation_id.value = donation.id;

        form.elements.quantity_kg.max = donation.remaining_kg;

        form.elements.quantity_kg.value = Math.max(1, Math.min(

            Number(currentPerson()?.capacity_kg || 1),

            Number(donation.remaining_kg || 1)

        ));

        form.elements.planned_pickup_at.min = inputDate(state.clock);

        form.elements.planned_pickup_at.value = inputDate(donation.pickup_from);

        $("#claimDonationSummary").textContent =

            `${donation.description} · ${donation.remaining_kg} kg remaining`;

        $("#eligibilityResult").className = "eligibility-result hidden";

        $("#eligibilityResult").textContent = "";

        openDialog("claimDialog");

    }

    function getClaimPayload() {

        const form = $("#claimForm");

        return {

            donation_id: String(form.elements.donation_id.value),

            volunteer_id: String(state.personId),

            quantity_kg: Number(form.elements.quantity_kg.value),

            planned_pickup_at: form.elements.planned_pickup_at.value

        };

    }

    function validateClaim(payload) {

        if (!payload.volunteer_id) {

            showNotice("Choose a volunteer profile first.", "error");

            return false;

        }

        if (!Number.isInteger(payload.quantity_kg) || payload.quantity_kg < 1) {

            showNotice("Quantity must be a positive whole number.", "error");

            return false;

        }

        if (!payload.planned_pickup_at) {

            showNotice("Choose a planned pickup time.", "error");

            return false;

        }

        return true;

    }

    function displayRejectionReasons(element, reasons) {

        if (!Array.isArray(reasons) || !reasons.length) return;

        const list = document.createElement("ul");

        reasons.forEach(reason => {

            const item = document.createElement("li");

            item.textContent = typeof reason === "string"

                ? reason

                : `Rule ${reason.rule || ""}: ${reason.message || "Not eligible"}`;

            list.appendChild(item);

        });

        element.appendChild(list);

    }

    async function previewClaim() {

        const payload = getClaimPayload();

        if (!validateClaim(payload)) return;

        const result = $("#eligibilityResult");

        result.className = "eligibility-result";

        result.textContent = "Checking eligibility...";

        try {

            const response = await API.post(

                "/api/claims/eligibility-preview/",

                payload

            );

            result.className = response.eligible

                ? "eligibility-result success"

                : "eligibility-result error";

            result.innerHTML = `

                <strong>${response.eligible ? "Eligible to claim" : "Claim not eligible"}</strong>

                <p>Remaining quantity: ${escapeHtml(response.remaining_kg)} kg</p>

            `;

            displayRejectionReasons(result, response.reasons);

        } catch (error) {

            result.className = "eligibility-result error";

            result.textContent = errorMessage(error);

            displayRejectionReasons(

                result,

                error?.payload?.error?.reasons

            );

        }

    }

    async function createClaim(event) {

        event.preventDefault();

        const payload = getClaimPayload();

        if (!validateClaim(payload)) return;

        try {

            await API.post("/api/claims/", payload);

            closeDialog("claimDialog");

            showNotice("Claim created successfully.");

            await refreshAfterMutation();

        } catch (error) {

            const result = $("#eligibilityResult");

            const reasons = error?.payload?.error?.reasons || [];

            if (reasons.length) {

                result.className = "eligibility-result error";

                result.textContent = errorMessage(error);

                displayRejectionReasons(result, reasons);

            }

            showError(error);

        }

    }

    // --------------------------------------------------

    // DONATION DETAILS AND CANCELLATION

    // --------------------------------------------------

    async function openDonationDetails(id) {

        try {

            const donation = await API.get(

                `/api/donations/${encodeURIComponent(id)}/`

            );

            $("#detailContent").innerHTML = `

                <div class="eyebrow">DONATION DETAILS</div>

                <h2>${escapeHtml(donation.description)}</h2>

                <div class="detail-stats">

                    <div><small>Listed</small><strong>${formatNumber(donation.quantity_kg)} kg</strong></div>

                    <div><small>Remaining</small><strong>${formatNumber(donation.remaining_kg)} kg</strong></div>

                    <div><small>Status</small>${statusBadge(donation.status)}</div>

                </div>

                <p><strong>Pickup window:</strong><br>

                    ${escapeHtml(formatDate(donation.pickup_from))}

                    — ${escapeHtml(formatDate(donation.pickup_until))}

                </p>

                <h3>Claims</h3>

                ${(donation.claims || []).length

                    ? `<div class="rank-list">${donation.claims.map(claim => `

                        <div class="rank-row">

                            <div>

                                <strong>Claim #${escapeHtml(claim.id)} · ${formatNumber(claim.quantity_kg)} kg</strong>

                                <small>Volunteer ${escapeHtml(claim.volunteer_id)}</small>

                            </div>

                            ${statusBadge(claim.status)}

                        </div>

                    `).join("")}</div>`

                    : '<div class="empty-inline">No claims returned for this donation.</div>'}

            `;

            openDialog("detailDialog");

        } catch (error) {

            showError(error);

        }

    }

    async function cancelDonation(id) {
        const donation = state.donations.find(item =>
            String(item.id) === String(id)
        );

        const isOwner =
            state.role === "donor" &&
            String(donation?.donor_id) === String(state.personId);

        if (!isOwner) {
            showNotice(
                "Only the donor who listed this donation can cancel it.",
                "error"
            );
            return;
        }

        if (donation.status !== "OPEN") {
            showNotice(
                "Only open donations can be cancelled.",
                "error"
            );
            return;
        }

        if (!confirm("Cancel this donation?")) return;

        try {
            await API.post(
                `/api/donations/${encodeURIComponent(id)}/cancel/`,
                { donor_id: String(state.personId) }
            );

            showNotice("Donation cancelled successfully.");
            await refreshAfterMutation();
        } catch (error) {
            showError(error);
        }
    }

    async function mutateClaim(id, action) {

        const message = action === "collect"

            ? "Mark this claim as collected?"

            : "Cancel this claim?";

        if (!confirm(message)) return;

        const endpoint = action === "collect" ? "collect" : "cancel";

        try {

            await API.post(

                `/api/claims/${encodeURIComponent(id)}/${endpoint}/`

            );

            showNotice(

                action === "collect"

                    ? "Claim collected successfully."

                    : "Claim cancelled successfully."

            );

            await refreshAfterMutation();

        } catch (error) {

            showError(error);

        }

    }

    // --------------------------------------------------

    // ADVANCE SIMULATED CLOCK

    // --------------------------------------------------

    async function advanceClock(event) {

        event.preventDefault();

        const value = event.currentTarget.elements.current_time.value;

        if (!value) {

            showNotice("Choose a simulated date and time.", "error");

            return;

        }

        if (state.clock && value < inputDate(state.clock)) {

            showNotice("The simulated clock cannot move backwards.", "error");

            return;

        }

        try {

            const response = await API.patch("/api/clock/", {

                current_time: value

            });

            state.clock = response.current_time;

            showNotice(

                `Clock advanced. ${response.missed_claims_updated} claim(s) marked missed.`

            );

            await refreshAfterMutation();

        } catch (error) {

            showError(error);

        }

    }

    // --------------------------------------------------

    // EVENT HANDLERS

    // --------------------------------------------------

function bindEvents() {

    $$(".nav-item[data-view]").forEach(button => {

        button.addEventListener("click", () => {

            showView(button.dataset.view);

        });

    });

    $("#clockNav").addEventListener("click", () => showView("clock"));

    $("#changePersonBtn").addEventListener("click", () => {

        $("#personRole").value = state.role || "donor";

        populatePeople();

        openDialog("personDialog");

    });

    $("#donorRoleBtn")?.addEventListener("click", () => {

        $("#personRole").value = "donor";

        populatePeople();

        openDialog("personDialog");

    });

    $("#volunteerRoleBtn")?.addEventListener("click", () => {

        $("#personRole").value = "volunteer";

        populatePeople();

        openDialog("personDialog");

    });

    $("#personRole").addEventListener("change", populatePeople);

    $("#personId").addEventListener("change", updatePersonDescription);

    $("#personForm").addEventListener("submit", async event => {

        event.preventDefault();

        const role = $("#personRole").value;

        const id = $("#personId").value;

        if (!id) {

            showNotice("Select a profile first.", "error");

            return;

        }

        await selectPerson(role, id);

    });

    $("#donationForm").addEventListener("submit", createDonation);

    $("#claimForm").addEventListener("submit", createClaim);

    $("#previewClaimBtn").addEventListener("click", previewClaim);

    // Handle Claim button clicks.

    document.addEventListener("click", function (event) {

        const button = event.target.closest("[data-claim]");

        if (!button) return;

        const donationId = button.dataset.claim;

        const donation = state.donations.find(item =>

            String(item.id) === String(donationId)

        );

        if (!donation) {

            showNotice(

                "Donation not found. Please refresh and try again.",

                "error"

            );

            return;

        }

        openClaimForm(donation);

    });

    }

    // --------------------------------------------------

    // START APPLICATION

    // --------------------------------------------------

    async function init() {

        bindEvents();

        setLoading(true);

        try {

            await loadInitialData();

            // Open the profile selector on first visit.

            if (!state.role || !state.personId) {

                $("#personRole").value = "donor";

                populatePeople();

                openDialog("personDialog");

            }

        } catch (error) {

            showError(error);

            $("#dashboardView").innerHTML = `

                <div class="connection-error">

                    <h2>Unable to load SurplusLink</h2>

                    <p>${escapeHtml(errorMessage(error))}</p>

                    <p>Ensure Django is running and the API routes are available.</p>

                    <button class="button primary" id="retryConnection">Retry connection</button>

                </div>

            `;

            $("#retryConnection").addEventListener("click", async () => {

                setLoading(true);

                try {

                    await loadInitialData();

                } catch (retryError) {

                    showError(retryError);

                } finally {

                    setLoading(false);

                }

            });

        } finally {

            setLoading(false);

        }

    }

    document.addEventListener("DOMContentLoaded", init);

})();
