document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('csv-file');
    const baseIncrementInput = document.getElementById('base-increment');
    const evalIntervalSelect = document.getElementById('eval-interval');
    const statusBar = document.getElementById('status-bar');
    const dashboardLists = document.getElementById('dashboard-lists');
    const downloadBtn = document.getElementById('download-capture');

    const warningContainer = document.getElementById('warning-container');
    const grayContainer = document.getElementById('gray-container');
    const topTotalContainer = document.getElementById('top-total-container');
    const topDailyContainer = document.getElementById('top-daily-container');
    
    // Containers Baru
    const leastTotalContainer = document.getElementById('least-total-container');
    const leastDailyContainer = document.getElementById('least-daily-container');

    const warningBadge = document.getElementById('warning-badge');
    const grayBadge = document.getElementById('gray-badge');

    const GRAY_BUFFER_MAX = 1000000;

    let globalRawCsvData = null;
    let globalWarningList = [];
    let globalGrayList = [];
    let globalUserGrayCounts = {};
    var globalBaseDailyIncrement = 0;

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            statusBar.textContent = `Processing file: ${file.name}...`;
            statusBar.classList.remove('hidden');
            
            Papa.parse(file, {
                skipEmptyLines: 'greedy',
                complete: function(results) {
                    globalRawCsvData = results.data;
                    processMetrics(globalRawCsvData);
                }
            });
        }
    });

    baseIncrementInput.addEventListener('input', () => {
        if (globalRawCsvData) {
            statusBar.textContent = "Recalculating with new daily target...";
            processMetrics(globalRawCsvData);
        }
    });

    if (evalIntervalSelect) {
        evalIntervalSelect.addEventListener('change', () => {
            if (globalRawCsvData) {
                statusBar.textContent = "Recalculating with new evaluation interval...";
                processMetrics(globalRawCsvData);
            }
        });
    }

    // ENGINE PEMBUAT GAMBAR TABEL (Iframe Terisolasi)
    downloadBtn.addEventListener('click', () => {
        statusBar.textContent = "Generating high-fidelity spreadsheet image...";

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.left = '-9999px';
        iframe.style.top = '-9999px';
        iframe.style.width = '1050px';
        iframe.style.height = '1000px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow.document;

        const dailyTargetFormatted = (globalBaseDailyIncrement / 1000000).toLocaleString('en-US', { 
            maximumFractionDigits: 2 
        });
        calculated_per = `<p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280; font-family: monospace;">Calculated per ${evalIntervalSelect.value} day(s)</p>`
        if (evalIntervalSelect.value == 1) {
            calculated_per = `<p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280; font-family: monospace;">Calculated per day</p>`
        }
        let tableHeaderHTML = `
            <div style="margin-bottom: 20px; font-family: Arial, sans-serif;">
                <h2 style="margin: 0; font-size: 20px; color: #1f2937; font-weight: bold;">Eclairs Origin Warn List</h2>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280; font-family: monospace;">Exported on: ${new Date().toLocaleString()}</p>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280; font-family: monospace;">Daily Fans: ${dailyTargetFormatted}M/day</p>
                ${calculated_per}
            </div>
        `;

        const spreadsheetRows = [];
        
        globalWarningList.forEach(user => {
            spreadsheetRows.push({
                ...user,
                type: 'Warn',
                grayCount: globalUserGrayCounts[user.id] || 0
            });
        });

        globalGrayList.forEach(user => {
            if (!globalWarningList.some(w => w.id === user.id)) {
                spreadsheetRows.push({
                    ...user,
                    type: 'Gray',
                    grayCount: 0,
                    grayDays: user.triggers
                });
            }
        });

        let spreadsheetTableHTML = `
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; table-layout: fixed; font-size: 13px; color: #374151; font-family: Arial, sans-serif;">
                <thead>
                    <tr style="background-color: #f1f5f9; text-align: left;">
                        <th style="width: 5%; border: 1px solid #cbd5e1; padding: 10px 8px; font-weight: bold; text-align: center; color: #475569;">#</th>
                        <th style="width: 25%; border: 1px solid #cbd5e1; padding: 10px 12px; font-weight: bold; color: #475569;">Trainer Name</th>
                        <th style="width: 18%; border: 1px solid #cbd5e1; padding: 10px 12px; font-weight: bold; color: #475569;">UID</th>
                        <th style="width: 12%; border: 1px solid #cbd5e1; padding: 10px 8px; font-weight: bold; text-align: center; color: #475569;">Status</th>
                        <th style="width: 10%; border: 1px solid #cbd5e1; padding: 10px 8px; font-weight: bold; text-align: center; color: #475569;">Count</th>
                        <th style="width: 30%; border: 1px solid #cbd5e1; padding: 10px 12px; font-weight: bold; color: #475569;">Triggered Days</th>
                    </tr>
                </thead>
                <tbody>
                    ${spreadsheetRows.length === 0 ? `
                        <tr>
                            <td colspan="6" style="border: 1px solid #cbd5e1; padding: 24px; text-align: center; color: #9ca3af; font-style: italic;">
                                No data records found to display.
                            </td>
                        </tr>
                    ` : spreadsheetRows.map((user, index) => {
                        const isWarning = user.type === 'Warn';
                        const rowBgColor = index % 2 === 0 ? '#ffffff' : '#f9fafb'; 
                        const primaryColor = isWarning ? '#dc2626' : '#4b5563'; 
                        const textTextColor = isWarning ? '#b91c1c' : '#4b5563';

                        let bonusTextHTML = '';
                        let grayDaysInfoHTML = '';
                        
                        if (isWarning && user.grayCount >= 3) {
                            const bonusAmount = Math.floor(user.grayCount / 3);
                            bonusTextHTML = ` <span style="color: #d97706; font-weight: bold; font-size: 11px;">(+${bonusAmount})</span>`;
                        }

                        if (user.grayDays && user.grayDays.length > 0) {
                            const grayAmount = user.grayCount;
                            if(isWarning){
                                bonusTextHTML += ` <span style="color: #4b5563; font-weight: bold; font-size: 11px;">(x${grayAmount})</span>`;
                                grayDaysInfoHTML = ` <span style="color: #4b5563; font-weight: 600; font-family: monospace; font-size: 12px; letter-spacing: 0.5px;">(${user.grayDays.join(', ')})</span>`;
                            }
                        }

                        let tagsHTML = '';
                        if (user.triggers.length === 0) {
                            tagsHTML = user.grayDays && user.grayDays.length > 0
                                ? `<span style="font-family: monospace; font-size: 12px; letter-spacing: 0.5px;">${grayDaysInfoHTML.trim()}</span>`
                                : '<span style="color:#9ca3af; font-style:italic; font-size:11px;">None</span>';
                        } else {
                            tagsHTML = `<span style="color: ${textTextColor}; font-weight: 600; font-family: monospace; font-size: 12px; letter-spacing: 0.5px;">${user.triggers.join(', ')}</span>${grayDaysInfoHTML}`;
                        }

                        return `
                            <tr style="background-color: ${rowBgColor};">
                                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; color: #6b7280; font-family: monospace;">${index + 1}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 8px 12px; font-weight: bold; color: #111827;">${escapeHtml(user.name)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 8px 12px; font-family: monospace; color: #4b5563;">${user.id}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: ${primaryColor}; font-size: 12px; letter-spacing: 0.5px;">
                                    ${user.type.toUpperCase()}
                                </td>
                                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: ${primaryColor}; font-family: monospace; font-size: 13px;">
                                    ${user.triggers.length}x${bonusTextHTML}
                                </td>
                                <td style="border: 1px solid #cbd5e1; padding: 8px 12px; white-space: normal; word-break: break-word;">
                                    ${tagsHTML}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        iframeDoc.open();
        iframeDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    * { box-sizing: border-box; }
                    body { margin: 0; padding: 0; background-color: #ffffff; }
                </style>
            </head>
            <body>
                <div id="render-target" style="padding: 32px; background-color: #ffffff; width: 1050px;">
                    ${tableHeaderHTML}
                    ${spreadsheetTableHTML}
                </div>
            </body>
            </html>
        `);
        iframeDoc.close();

        setTimeout(() => {
            const renderTarget = iframeDoc.getElementById('render-target');
            
            html2canvas(renderTarget, {
                scale: 2, 
                useCORS: true, 
                backgroundColor: '#ffffff'
            }).then(canvas => {
                const imageURL = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = `Club_Report_Warn_List_${new Date().toISOString().split('T')[0]}.png`;
                link.href = imageURL;
                link.click();
                
                document.body.removeChild(iframe);
                statusBar.textContent = "Spreadsheet image download complete!";
            }).catch(err => {
                console.error("Canvas capture error:", err);
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
                statusBar.textContent = "Error generating spreadsheet image asset.";
            });
        }, 100);
    });

    function processMetrics(data) {
        if (!data || data.length < 2) return;

        const rawInputValue = baseIncrementInput.value.trim();
        const BASE_DAILY_INCREMENT = parseInt(rawInputValue, 10);

        if (!rawInputValue || isNaN(BASE_DAILY_INCREMENT) || BASE_DAILY_INCREMENT <= 0) {
            alert("Target Harian harus berupa angka lebih besar dari 0!");
            baseIncrementInput.focus();
            return; 
        }

        const EVAL_INTERVAL = evalIntervalSelect ? parseInt(evalIntervalSelect.value, 10) : 2;

        globalBaseDailyIncrement = BASE_DAILY_INCREMENT;
        const headers = data[0].map(h => h.trim());
        const rows = data.slice(1);

        globalWarningList = [];
        globalGrayList = [];
        globalUserGrayCounts = {};

        let userTotals = [];
        let userBestDailies = [];

        rows.forEach(row => {
            if (row.length < 2) return;
            const trainerId = row[0]?.trim();
            const trainerName = row[1]?.trim();
            if (!trainerId || !trainerName) return;
            
            // --- A. TOP & LEAST CALCULATIONS ---
            let lastValue = null;
            let lastDay = null;
            let maxDailyGain = -Infinity;
            let maxDailyDay = null;

            for (let idx = 2; idx < headers.length; idx++) {
                if (idx >= row.length) break;
                
                const rawValStr = row[idx]?.trim();
                if (rawValStr === '' || rawValStr === undefined) continue;

                const score = parseInt(rawValStr, 10);
                if (isNaN(score) || (lastValue === null && score === 0)) continue;

                const dayNum = parseInt(headers[idx].replace(/\D/g, ''), 10);

                let dailyGain = 0;
                if (lastValue === null) {
                    dailyGain = score;
                } else {
                    dailyGain = score - lastValue;
                }

                if (dailyGain > maxDailyGain) {
                    maxDailyGain = dailyGain;
                    maxDailyDay = dayNum;
                } else if (dailyGain === maxDailyGain && maxDailyDay !== null) {
                    if (dayNum < maxDailyDay) {
                        maxDailyDay = dayNum;
                    }
                }

                lastValue = score;
                lastDay = dayNum;
            }

            if (lastValue !== null) {
                userTotals.push({
                    name: trainerName,
                    id: trainerId,
                    totalGain: lastValue,
                    latestDay: lastDay
                });
            }

            if (maxDailyGain !== -Infinity && maxDailyDay !== null) {
                userBestDailies.push({
                    name: trainerName,
                    id: trainerId,
                    maxGain: maxDailyGain,
                    dayNum: maxDailyDay
                });
            }

            // --- B. WARN & GRAY CALCULATIONS ---
            let entryDayNum = null;
            for (let idx = 2; idx < row.length; idx++) {
                const rawValStr = row[idx]?.trim();
                if (rawValStr !== undefined && rawValStr !== '') {
                    const val = parseInt(rawValStr, 10);
                    if (!isNaN(val) && val > 0) {
                        entryDayNum = parseInt(headers[idx].replace(/\D/g, ''), 10);
                        break;
                    }
                }
            }

            if (entryDayNum === null) return;

            const warningsForUser = [];
            const graysForUser = [];

            for (let idx = 2; idx < headers.length; idx++) {
                const dayNum = parseInt(headers[idx].replace(/\D/g, ''), 10);
                
                if (dayNum % EVAL_INTERVAL !== 0) continue;
                if (idx >= row.length) break;

                const rawValStr = row[idx]?.trim();
                
                if (rawValStr === '' && dayNum > entryDayNum) break;
                if (rawValStr === '') continue;

                const score = parseInt(rawValStr, 10);
                if (isNaN(score) || (score === 0 && dayNum <= entryDayNum)) continue;

                const personalElapsedDays = (dayNum - entryDayNum) + 1;
                let targetThreshold = personalElapsedDays * BASE_DAILY_INCREMENT;

                if (dayNum === entryDayNum) {
                    targetThreshold = BASE_DAILY_INCREMENT; 
                }

                if (score < targetThreshold) {
                    const deficit = targetThreshold - score;
                    
                    if (deficit <= GRAY_BUFFER_MAX) {
                        graysForUser.push(`Day ${dayNum}`);
                    } else {
                        warningsForUser.push(`Day ${dayNum}`);
                    }
                }
            }

            globalUserGrayCounts[trainerId] = graysForUser.length;

            const warnCount = warningsForUser.length;
            const grayCount = graysForUser.length;
            const calculatedWeight = ((warnCount * 3) * 1.1) + (grayCount * 1);

            if (warningsForUser.length > 0) {
                globalWarningList.push({ 
                    name: trainerName, 
                    id: trainerId, 
                    triggers: warningsForUser,
                    grayDays: graysForUser,
                    weightScore: calculatedWeight 
                });
            }
            if (graysForUser.length > 0) {
                globalGrayList.push({ 
                    name: trainerName, 
                    id: trainerId, 
                    triggers: graysForUser,
                    weightScore: calculatedWeight 
                });
            }
            
            if (warningsForUser.length === 0 && graysForUser.length >= 3) {
                globalWarningList.push({ 
                    name: trainerName, 
                    id: trainerId, 
                    triggers: [],
                    grayDays: graysForUser,
                    weightScore: calculatedWeight 
                });
            }
        });

        globalWarningList.sort((a, b) => b.weightScore - a.weightScore);
        globalGrayList.sort((a, b) => b.weightScore - a.weightScore);

        // Sorting Most Gain (Descending)
        userTotals.sort((a, b) => b.totalGain - a.totalGain);
        const top5Totals = userTotals.slice(0, 5);

        userBestDailies.sort((a, b) => {
            if (b.maxGain !== a.maxGain) {
                return b.maxGain - a.maxGain;
            }
            return a.dayNum - b.dayNum;
        });
        const top5Dailies = userBestDailies.slice(0, 5);

        // Sorting Least Gain (Ascending)
        const leastTotals = [...userTotals].sort((a, b) => a.totalGain - b.totalGain).slice(0, 3);
        const leastDailies = [...userBestDailies].sort((a, b) => a.maxGain - b.maxGain).slice(0, 3);

        renderDashboard(globalWarningList, globalGrayList, globalUserGrayCounts, top5Totals, top5Dailies, leastTotals, leastDailies);
    }

    function renderDashboard(warnings, grays, userGrayCounts, topTotals, topDailies, leastTotals, leastDailies) {
        warningContainer.innerHTML = '';
        grayContainer.innerHTML = '';
        topTotalContainer.innerHTML = '';
        topDailyContainer.innerHTML = '';
        if (leastTotalContainer) leastTotalContainer.innerHTML = '';
        if (leastDailyContainer) leastDailyContainer.innerHTML = '';

        warningBadge.textContent = `${warnings.length} Users`;
        grayBadge.textContent = `${grays.length} Users`;

        if (warnings.length === 0) {
            warningContainer.innerHTML = `<p class="text-sm text-slate-400 p-4 text-center">Belum ada Daftar Warn.</p>`;
        } else {
            warnings.forEach(user => {
                const grayCount = userGrayCounts[user.id] || 0;
                warningContainer.appendChild(createRowElement(user, 'rose', grayCount));
            });
        }

        if (grays.length === 0) {
            grayContainer.innerHTML = `<p class="text-sm text-slate-400 p-4 text-center">Belum Ada Daftar Gray.</p>`;
        } else {
            grays.forEach(user => {
                grayContainer.appendChild(createRowElement(user, 'slate', 0));
            });
        }

        // Top 5 Total Gain
        if (topTotals.length === 0) {
            topTotalContainer.innerHTML = '<p class="text-sm text-slate-400 py-4 text-center">Tidak ada data</p>';
        } else {
            topTotals.forEach((item, index) => {
                const el = document.createElement('div');
                el.className = 'py-3 flex items-center justify-between text-sm';
                el.innerHTML = `
                    <div class="flex items-center gap-3">
                        <span class="w-6 h-6 rounded-full ${index === 0 ? 'bg-amber-400 text-white' : index === 1 ? 'bg-slate-300 text-slate-700' : index === 2 ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-500'} font-bold text-xs flex items-center justify-center">
                            ${index + 1}
                        </span>
                        <div>
                            <p class="font-bold text-slate-800">${escapeHtml(item.name)}</p>
                            <p class="text-xs text-slate-400">ID: ${escapeHtml(item.id)}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-extrabold text-emerald-600">${item.totalGain.toLocaleString('id-ID')}</p>
                        <p class="text-[10px] text-slate-400">Latest: Day ${item.latestDay}</p>
                    </div>
                `;
                topTotalContainer.appendChild(el);
            });
        }

        // Top 5 Daily Gain
        if (topDailies.length === 0) {
            topDailyContainer.innerHTML = '<p class="text-sm text-slate-400 py-4 text-center">Tidak ada data</p>';
        } else {
            topDailies.forEach((item, index) => {
                const el = document.createElement('div');
                el.className = 'py-3 flex items-center justify-between text-sm';
                el.innerHTML = `
                    <div class="flex items-center gap-3">
                        <span class="w-6 h-6 rounded-full ${index === 0 ? 'bg-amber-400 text-white' : index === 1 ? 'bg-slate-300 text-slate-700' : index === 2 ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-500'} font-bold text-xs flex items-center justify-center">
                            ${index + 1}
                        </span>
                        <div>
                            <p class="font-bold text-slate-800">${escapeHtml(item.name)}</p>
                            <p class="text-xs text-slate-400">ID: ${escapeHtml(item.id)}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-extrabold text-amber-600">+${item.maxGain.toLocaleString('id-ID')}</p>
                        <p class="text-[10px] text-slate-400 font-medium">Triggered: Day ${item.dayNum}</p>
                    </div>
                `;
                topDailyContainer.appendChild(el);
            });
        }

        // Top 3 Least Total Gain
        if (leastTotalContainer) {
            if (leastTotals.length === 0) {
                leastTotalContainer.innerHTML = '<p class="text-sm text-slate-400 py-4 text-center">Tidak ada data</p>';
            } else {
                leastTotals.forEach((item, index) => {
                    const el = document.createElement('div');
                    el.className = 'py-3 flex items-center justify-between text-sm';
                    el.innerHTML = `
                        <div class="flex items-center gap-3">
                            <span class="w-6 h-6 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center">
                                ${index + 1}
                            </span>
                            <div>
                                <p class="font-bold text-slate-800">${escapeHtml(item.name)}</p>
                                <p class="text-xs text-slate-400">ID: ${escapeHtml(item.id)}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="font-extrabold text-rose-600">${item.totalGain.toLocaleString('id-ID')}</p>
                            <p class="text-[10px] text-slate-400">Latest: Day ${item.latestDay}</p>
                        </div>
                    `;
                    leastTotalContainer.appendChild(el);
                });
            }
        }

        // Top 3 Least Daily Gain
        if (leastDailyContainer) {
            if (leastDailies.length === 0) {
                leastDailyContainer.innerHTML = '<p class="text-sm text-slate-400 py-4 text-center">Tidak ada data</p>';
            } else {
                leastDailies.forEach((item, index) => {
                    const el = document.createElement('div');
                    el.className = 'py-3 flex items-center justify-between text-sm';
                    el.innerHTML = `
                        <div class="flex items-center gap-3">
                            <span class="w-6 h-6 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center">
                                ${index + 1}
                            </span>
                            <div>
                                <p class="font-bold text-slate-800">${escapeHtml(item.name)}</p>
                                <p class="text-xs text-slate-400">ID: ${escapeHtml(item.id)}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="font-extrabold text-rose-600">+${item.maxGain.toLocaleString('id-ID')}</p>
                            <p class="text-[10px] text-slate-400 font-medium">Recorded: Day ${item.dayNum}</p>
                        </div>
                    `;
                    leastDailyContainer.appendChild(el);
                });
            }
        }

        statusBar.textContent = "Data processing complete.";
        dashboardLists.classList.remove('hidden');
        downloadBtn.classList.remove('hidden');
    }

    function createRowElement(user, color, grayCount) {
        const div = document.createElement('div');
        div.className = 'py-3.5 px-2 flex items-center justify-between gap-2 border-b border-slate-100 last:border-0';
        
        const totalViolationsCount = user.triggers.length;
        const badgeBg = color === 'rose' ? 'bg-rose-600' : 'bg-slate-500';
        
        let bonusBadge = '';
        if (color === 'rose' && grayCount >= 3) {
            const bonusAmount = Math.floor(grayCount / 3);
            bonusBadge = `<span class="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold ml-1 flex items-center justify-center h-4.5 min-w-6 text-center select-none">+${bonusAmount}</span>`;
        }

        const tagsHTML = user.triggers.map(day => {
            return `<span class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded ${
                color === 'rose' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
            }">${day}</span>`;
        }).join(' ');

        div.innerHTML = `
            <div class="flex items-center gap-2">
                <div>
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <h4 class="font-bold text-sm text-slate-800 leading-none">${escapeHtml(user.name)}</h4>
                        <div class="flex items-center select-none">
                            <span class="text-[10px] ${badgeBg} text-white px-1.5 py-0.5 rounded-full font-bold flex items-center justify-center h-4.5 min-w-6 text-center select-none">${totalViolationsCount}x</span>
                            ${bonusBadge}
                        </div>
                    </div>
                    <p class="text-xs text-slate-400 font-mono mt-1 leading-none">UID: ${user.id}</p>
                </div>
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