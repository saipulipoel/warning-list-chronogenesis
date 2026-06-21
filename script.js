document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('csv-file');
    const statusBar = document.getElementById('status-bar');
    const dashboardLists = document.getElementById('dashboard-lists');
    
    const warningContainer = document.getElementById('warning-container');
    const grayContainer = document.getElementById('gray-container');
    const warningBadge = document.getElementById('warning-badge');
    const grayBadge = document.getElementById('gray-badge');

    // Global Base Configurations
    const BASE_DAILY_INCREMENT = 300000; 
    const GRAY_BUFFER_MAX = 1000000;     // 1,000,000 allowance zone

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            statusBar.textContent = `Processing file: ${file.name}...`;
            statusBar.classList.remove('hidden');
            
            Papa.parse(file, {
                skipEmptyLines: 'greedy',
                complete: function(results) {
                    processMetrics(results.data);
                }
            });
        }
    });

    function processMetrics(data) {
        if (data.length < 2) return;

        // Extract header indexes dynamically to match arbitrary day count sizes
        const headers = data[0].map(h => h.trim());
        const rows = data.slice(1);

        const warningList = [];
        const grayList = [];

        rows.forEach(row => {
            if (row.length < 2) return;
            
            const trainerId = row[0]?.trim();
            const trainerName = row[1]?.trim();
            
            // 1. Trace the explicit onboarding day index for the individual trainer
            let firstActiveDay = null;
            let firstActiveDayIdx = -1;

            for (let idx = 2; idx < row.length; idx++) {
                if (row[idx] !== undefined && row[idx].trim() !== '') {
                    firstActiveDayIdx = idx;
                    // Extract the number from string header (e.g., "Day 3" -> 3)
                    firstActiveDay = parseInt(headers[idx].replace(/\D/g, ''), 10);
                    break;
                }
            }

            // If user has zero records across all cells, skip
            if (firstActiveDay === null) return;

            const warningsForUser = [];
            const graysForUser = [];

            // 2. Scan every cell column inside row
            for (let idx = firstActiveDayIdx; idx < row.length; idx++) {
                const dayNum = parseInt(headers[idx].replace(/\D/g, ''), 10);
                
                // Rule 1: Evaluate metric milestones only on standard even days
                if (dayNum % 2 !== 0) continue;

                const rawValStr = row[idx]?.trim();
                
                // Rule 8: If cell data runs empty downstream, they dropped off; break loop
                if (rawValStr === '') break;

                const score = parseInt(rawValStr, 10);
                if (isNaN(score)) continue;

                // 3. Compute Dynamic Threshold based on historical rules
                let targetThreshold = dayNum * BASE_DAILY_INCREMENT; // Standard Default (Day * 300,000)

                // Rule 6: Handle specific exception list adjustments
                if (trainerName.includes('Muu') || trainerName.includes('Rae')) {
                    if (dayNum === 2) targetThreshold = 3000000;
                } else if (trainerName.includes('AldyWS') || trainerName.includes('MzFaza')) {
                    if (dayNum === 4) targetThreshold = 3000000;
                } 
                // Rule 7: Mid-cycle join offsets (Onboarded on late odd days)
                else if (firstActiveDay > 1 && firstActiveDay % 2 !== 0) {
                    // Allowed cycle length = Current relative timeframe minus entry buffer index
                    const trackingSpanDays = (dayNum - firstActiveDay) + 1;
                    targetThreshold = trackingSpanDays * BASE_DAILY_INCREMENT;
                }

                // 4. Run classification engine
                if (score < targetThreshold) {
                    const deviationAmt = targetThreshold - score;
                    
                    // Rule 4: Assess if missing window falls within Gray List buffer allowance
                    if (deviationAmt <= GRAY_BUFFER_MAX) {
                        graysForUser.push(`Day ${dayNum}`);
                    } else {
                        warningsForUser.push(`Day ${dayNum}`);
                    }
                }
            }

            // Push processed results if flags exist
            if (warningsForUser.length > 0) {
                warningList.push({ name: trainerName, id: trainerId, triggers: warningsForUser });
            }
            if (graysForUser.length > 0) {
                grayList.push({ name: trainerName, id: trainerId, triggers: graysForUser });
            }
        });

        renderDashboard(warningList, grayList);
    }

    function renderDashboard(warnings, grays) {
        // Clear previous runs
        warningContainer.innerHTML = '';
        grayContainer.innerHTML = '';

        // Update Counter Badges
        warningBadge.textContent = `${warnings.length} Users`;
        grayBadge.textContent = `${grays.length} Users`;

        // Render Warnings
        if (warnings.length === 0) {
            warningContainer.innerHTML = `<p class="text-sm text-slate-400 p-4 text-center">No structural warning logs raised.</p>`;
        } else {
            warnings.forEach(user => {
                warningContainer.appendChild(createRowElement(user, 'rose'));
            });
        }

        // Render Grays
        if (grays.length === 0) {
            grayContainer.innerHTML = `<p class="text-sm text-slate-400 p-4 text-center">No active buffer tolerances monitored.</p>`;
        } else {
            grays.forEach(user => {
                grayContainer.appendChild(createRowElement(user, 'slate'));
            });
        }

        // Reveal complete view
        statusBar.textContent = "Data processing complete.";
        dashboardLists.classList.remove('hidden');
    }

    function createRowElement(user, color) {
        const div = document.createElement('div');
        div.className = 'py-3.5 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2';
        
        // Group and count occurrences of logged days (Rule 5)
        const dayCounts = {};
        user.triggers.forEach(day => {
            dayCounts[day] = (dayCounts[day] || 0) + 1;
        });

        // Build HTML indicator tags
        const tagsHTML = Object.entries(dayCounts).map(([day, count]) => {
            const countBadge = count > 1 ? `<span class="ml-1 bg-white/40 px-1 rounded text-[10px]">${count}x</span>` : '';
            return `<span class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded ${
                color === 'rose' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
            }">${day}${countBadge}</span>`;
        }).join(' ');

        div.innerHTML = `
            <div>
                <h4 class="font-bold text-sm text-slate-800">${escapeHtml(user.name)}</h4>
                <p class="text-xs text-slate-400 font-mono mt-0.5">UID: ${user.id}</p>
            </div>
            <div class="flex flex-wrap gap-1.5 items-center">
                ${tagsHTML}
            </div>
        `;
        return div;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
});