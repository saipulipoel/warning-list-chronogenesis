document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('csv-file');
    const statusBar = document.getElementById('status-bar');
    const dashboardLists = document.getElementById('dashboard-lists');
    
    const warningContainer = document.getElementById('warning-container');
    const grayContainer = document.getElementById('gray-container');
    const warningBadge = document.getElementById('warning-badge');
    const grayBadge = document.getElementById('gray-badge');

    // FIXED: Updated daily increment threshold to 3,000,000
    const BASE_DAILY_INCREMENT = 3000000; 
    const GRAY_BUFFER_MAX = 1000000;

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

        const headers = data[0].map(h => h.trim());
        const rows = data.slice(1);

        const warningList = [];
        const grayList = [];

        rows.forEach(row => {
            if (row.length < 2) return;
            
            const trainerId = row[0]?.trim();
            const trainerName = row[1]?.trim();
            if (!trainerId || !trainerName) return;
            
            // Find when the trainer actually joined by scanning columns
            let firstActiveDay = null;
            let firstActiveDayIdx = -1;

            for (let idx = 2; idx < row.length; idx++) {
                if (row[idx] !== undefined && row[idx].trim() !== '') {
                    firstActiveDayIdx = idx;
                    firstActiveDay = parseInt(headers[idx].replace(/\D/g, ''), 10);
                    break;
                }
            }

            // Skip if they have completely empty rows
            if (firstActiveDay === null) return;

            const warningsForUser = [];
            const graysForUser = [];

            // Loop through all headers dynamically (supports up to Day 31 and beyond)
            for (let idx = 2; idx < headers.length; idx++) {
                const dayNum = parseInt(headers[idx].replace(/\D/g, ''), 10);
                
                // Rule 1: We only audit on Even Days
                if (dayNum % 2 !== 0) continue;

                // Rule 8: If the data array doesn't have this column yet, skip it safely
                if (idx >= row.length) break;

                const rawValStr = row[idx]?.trim();
                
                // Rule 8: If they were stripped/dropped off next day, ignore subsequent spaces
                if (rawValStr === '' && dayNum > firstActiveDay) break;
                if (rawValStr === '') continue;

                const score = parseInt(rawValStr, 10);
                if (isNaN(score)) continue;

                // Calculate the Threshold base rule (Day * 3,000,000)
                let targetThreshold = dayNum * BASE_DAILY_INCREMENT;

                // Rule 6: Handle specific name exceptions
                if (trainerName.includes('Muu') || trainerName.includes('Rae')) {
                    if (dayNum === 2) targetThreshold = 3000000;
                } else if (trainerName.includes('AldyWS') || trainerName.includes('MzFaza')) {
                    if (dayNum === 4) targetThreshold = 3000000;
                } 
                // Rule 7: Mid-cycle joins on an ODD day changes baseline equation
                else if (firstActiveDay > 1 && firstActiveDay % 2 !== 0) {
                    if (dayNum >= firstActiveDay) {
                        const activeSpan = (dayNum - firstActiveDay) + 1;
                        targetThreshold = activeSpan * BASE_DAILY_INCREMENT;
                    }
                }

                // Check violations
                if (score < targetThreshold) {
                    const deficit = targetThreshold - score;
                    
                    // Rule 4: If inside the 1,000,000 buffer window, it goes to Gray List
                    if (deficit <= GRAY_BUFFER_MAX) {
                        graysForUser.push(`Day ${dayNum}`);
                    } else {
                        warningsForUser.push(`Day ${dayNum}`);
                    }
                }
            }

            // Add to lists if triggers occurred
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
        warningContainer.innerHTML = '';
        grayContainer.innerHTML = '';

        warningBadge.textContent = `${warnings.length} Users`;
        grayBadge.textContent = `${grays.length} Users`;

        if (warnings.length === 0) {
            warningContainer.innerHTML = `<p class="text-sm text-slate-400 p-4 text-center">No structural warning logs raised.</p>`;
        } else {
            warnings.forEach(user => {
                warningContainer.appendChild(createRowElement(user, 'rose'));
            });
        }

        if (grays.length === 0) {
            grayContainer.innerHTML = `<p class="text-sm text-slate-400 p-4 text-center">No active buffer tolerances monitored.</p>`;
        } else {
            grays.forEach(user => {
                grayContainer.appendChild(createRowElement(user, 'slate'));
            });
        }

        statusBar.textContent = "Data processing complete.";
        dashboardLists.classList.remove('hidden');
    }

    function createRowElement(user, color) {
        const div = document.createElement('div');
        div.className = 'py-3.5 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2';
        
        // Count total violations for the individual to display as a counter total
        const totalViolationsCount = user.triggers.length;

        // Map and render the bad days cleanly
        const tagsHTML = user.triggers.map(day => {
            return `<span class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded ${
                color === 'rose' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
            }">${day}</span>`;
        }).join(' ');

        div.innerHTML = `
            <div>
                <div class="flex items-center gap-2">
                    <h4 class="font-bold text-sm text-slate-800">${escapeHtml(user.name)}</h4>
                    <span class="text-xs px-1.5 py-0.2 rounded-full font-bold ${
                        color === 'rose' ? 'bg-rose-600 text-white' : 'bg-slate-500 text-white'
                    }">
                        ${totalViolationsCount}x
                    </span>
                </div>
                <p class="text-xs text-slate-400 font-mono mt-0.5">UID: ${user.id}</p>
            </div>
            <div class="flex flex-wrap gap-1.5 items-center max-w-xs justify-end">
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